import React, { useState, useRef } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Loader2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { RawMaterial } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface ExcelImportModalProps {
  onClose: () => void;
  onImport: (materials: RawMaterial[]) => Promise<void> | void;
}

interface ParsedRow {
  name: string;
  category: string;
  description: string;
  unit: string;
  costPerUnit: number;
  stock: number;
  isValid: boolean;
  errors: string[];
}

export default function ExcelImportModal({ onClose, onImport }: ExcelImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const parseFile = (file: File) => {
    setIsParsing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const allParsedRows: ParsedRow[] = [];

        workbook.SheetNames.forEach(sheetName => {
          console.log(`Parsing sheet: ${sheetName}`);
          const worksheet = workbook.Sheets[sheetName];
          
          // Convert to array of arrays first to find the header row
          const allRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          console.log(`Sheet ${sheetName} has ${allRows.length} rows`);
          
          if (allRows.length === 0) return;

          // Find the header row (the first row that contains "Insumo", "Nombre", etc.)
          let headerRowIndex = 0;
          const headerKeywords = ['insumo', 'nombre', 'name', 'costo', 'cost', 'precio', 'unidad', 'unit'];
          
          for (let i = 0; i < Math.min(allRows.length, 15); i++) {
            const row = allRows[i];
            if (Array.isArray(row) && row.some(cell => 
              typeof cell === 'string' && headerKeywords.some(k => cell.toLowerCase().includes(k))
            )) {
              headerRowIndex = i;
              console.log(`Found header row for ${sheetName} at index ${i}`);
              break;
            }
          }

          // Convert to JSON using the found header row
          const json = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex }) as Record<string, any>[];
          console.log(`Parsed ${json.length} rows from ${sheetName}`);

          const sheetRows: ParsedRow[] = json.map((row, idx) => {
            const errors: string[] = [];
            
            // Helper to get value by case-insensitive key matching
            const getRowValue = (row: any, possibleKeys: string[]) => {
              const keys = Object.keys(row);
              for (const pk of possibleKeys) {
                const foundKey = keys.find(k => k.toLowerCase().trim() === pk.toLowerCase().trim());
                if (foundKey !== undefined) return row[foundKey];
              }
              return null;
            };

            // Helper to parse numbers that might have commas as decimals (Spanish format) or dots (English format)
            const parseNum = (val: any) => {
              if (val === null || val === undefined) return 0;
              if (typeof val === 'number') return val;
              const str = String(val).trim();
              if (!str) return 0;
              
              // If it has a comma and no dots, or a comma after a dot, it's likely Spanish format
              // e.g., "1.234,56" or "1234,56"
              if (str.includes(',') && !str.includes('.')) {
                return parseFloat(str.replace(',', '.')) || 0;
              }
              if (str.includes(',') && str.includes('.')) {
                // Determine which one is the decimal separator
                if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
                  // Spanish: 1.234,56
                  return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
                } else {
                  // English: 1,234.56
                  return parseFloat(str.replace(/,/g, '')) || 0;
                }
              }
              // Default to standard parseFloat for simple cases like "1234.56" or "1234"
              return parseFloat(str.replace(/,/g, '')) || 0;
            };

            const name = String(getRowValue(row, ['Insumo', 'Nombre', 'Name', 'Producto']) || '').trim();
            const category = String(getRowValue(row, ['Categoría', 'Categoria', 'Category']) || sheetName).trim();
            const description = String(getRowValue(row, ['Descripción', 'Descripcion', 'Description']) || '').trim();
            const unit = String(getRowValue(row, ['Unidad', 'Unit', 'UOM', 'Medida']) || 'u').trim().toLowerCase();
            
            // Cost detection
            const costPerUnit = parseNum(getRowValue(row, ['Costo', 'Cost', 'Precio', 'Price', 'Costo Unitario', 'Costo de Compra']));
            const stock = parseNum(getRowValue(row, ['Stock', 'Cantidad', 'Quantity']));

            if (!name) errors.push('Nombre es requerido');
            if (isNaN(costPerUnit) || costPerUnit === 0) {
              errors.push('Costo inválido o en cero');
            }

            return {
              name,
              category: category || sheetName,
              description,
              unit,
              costPerUnit,
              stock,
              isValid: errors.length === 0 && name !== '',
              errors
            };
          }).filter(row => row.name !== '' && row.name.toLowerCase() !== 'insumo' && row.name.toLowerCase() !== 'producto');

          allParsedRows.push(...sheetRows);
        });

        if (allParsedRows.length === 0) {
          alert('No se encontraron datos válidos en ninguna de las hojas del archivo.');
          setIsParsing(false);
          return;
        }

        setParsedData(allParsedRows);
        setStep('review');
      } catch (error) {
        console.error('Error parsing file:', error);
        alert('Error al leer el archivo. Asegúrate de que sea un archivo Excel (.xlsx, .xls) o CSV válido.');
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    setIsParsing(true);
    try {
      const validRows = parsedData.filter(r => r.isValid);
      console.log(`handleImport: Found ${validRows.length} valid rows out of ${parsedData.length}`);
      if (validRows.length === 0) {
        alert('No hay insumos válidos para importar.');
        setIsParsing(false);
        return;
      }

      const materialsToImport: RawMaterial[] = validRows.map(row => {
        let dimension = 'units';
        let baseUnit = 'u';
        
        if (['g', 'kg', 'mg'].includes(row.unit)) {
          dimension = 'weight';
          baseUnit = 'g';
        } else if (['ml', 'l', 'cc'].includes(row.unit)) {
          dimension = 'volume';
          baseUnit = 'ml';
        } else if (['cm', 'm', 'mm'].includes(row.unit)) {
          dimension = 'length';
          baseUnit = 'cm';
        }

        let costPerUnit = row.costPerUnit;
        let stock = row.stock;

        // Convert to base units if necessary
        if (row.unit === 'kg') {
          costPerUnit = row.costPerUnit / 1000;
          stock = row.stock * 1000;
        } else if (row.unit === 'l') {
          costPerUnit = row.costPerUnit / 1000;
          stock = row.stock * 1000;
        } else if (row.unit === 'm') {
          costPerUnit = row.costPerUnit / 100;
          stock = row.stock * 100;
        }

        return {
          id: uuidv4(),
          name: row.name,
          category: row.category,
          description: row.description,
          unit: row.unit,
          dimension,
          baseUnit,
          costPerUnit,
          stock,
          minStock: 0
        };
      });

      console.log('Importing materials:', materialsToImport.length, materialsToImport);
      
      if (materialsToImport.length === 0) {
        console.warn('No materials to import after mapping');
        setIsParsing(false);
        return;
      }

      await onImport(materialsToImport);
      console.log('Import callback completed');
      onClose();
    } catch (error) {
      console.error('Error in handleImport:', error);
      alert('Hubo un error al guardar los insumos. Por favor intenta de nuevo.');
    } finally {
      setIsParsing(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Nombre': 'Cera de Soja BPF',
        'Categoría': 'Ceras',
        'Descripción': 'Cera de soja de bajo punto de fusión',
        'Unidad': 'kg',
        'Costo': 4500,
        'Stock': 10
      },
      {
        'Nombre': 'Esencia Vainilla',
        'Categoría': 'Esencias',
        'Descripción': 'Esencia pura concentrada',
        'Unidad': 'ml',
        'Costo': 15000,
        'Stock': 500
      },
      {
        'Nombre': 'Pabilo Algodón',
        'Categoría': 'Pabilos',
        'Descripción': 'Pabilo trenzado',
        'Unidad': 'm',
        'Costo': 200,
        'Stock': 50
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla Insumos");
    
    // Auto-size columns
    const colWidths = [
      { wch: 30 }, // Nombre
      { wch: 20 }, // Categoría
      { wch: 40 }, // Descripción
      { wch: 10 }, // Unidad
      { wch: 15 }, // Costo
      { wch: 10 }, // Stock
    ];
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, "plantilla_insumos_janlu.xlsx");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-stone-100 dark:border-stone-800 shrink-0">
          <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">Importar Insumos desde Excel</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' ? (
            <div className="space-y-6">
              <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                <h3 className="font-semibold text-indigo-900 dark:text-indigo-300 mb-2">Instrucciones:</h3>
                <ul className="list-disc list-inside text-sm text-indigo-800 dark:text-indigo-400 space-y-1">
                  <li>El archivo debe tener una fila de encabezados (ej: Nombre, Costo, Unidad, etc.)</li>
                  <li>El sistema buscará automáticamente las columnas por su nombre.</li>
                  <li>Los insumos se agregarán a tu inventario.</li>
                </ul>
                <button
                  onClick={downloadTemplate}
                  className="mt-4 flex items-center text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                >
                  <Download size={16} className="mr-1" />
                  Descargar plantilla de ejemplo
                </button>
              </div>

              <div 
                className="border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-2xl p-12 text-center hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={48} className="mx-auto text-stone-400 mb-4" />
                <p className="text-lg font-medium text-stone-900 dark:text-stone-100 mb-2">
                  Haz clic para seleccionar un archivo
                </p>
                <p className="text-sm text-stone-500 dark:text-stone-400">Soporta Excel (.xlsx, .xls) y Google Sheets (exportado como Excel o CSV)</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-stone-50 dark:bg-stone-800/50 p-4 rounded-xl">
                <div className="flex items-center space-x-4">
                  <FileText className="text-indigo-600 dark:text-indigo-400" size={24} />
                  <div>
                    <p className="font-medium text-stone-900 dark:text-stone-100">{file?.name}</p>
                    <p className="text-sm text-stone-500 dark:text-stone-400">
                      {parsedData.length} filas encontradas • {parsedData.filter(r => r.isValid).length} válidas
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setStep('upload'); setFile(null); setParsedData([]); }}
                  className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                >
                  Cambiar archivo
                </button>
              </div>

              <div className="border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-stone-50 dark:bg-stone-800/80 text-stone-600 dark:text-stone-400 border-b border-stone-200 dark:border-stone-700">
                      <tr>
                        <th className="p-4 font-medium">Estado</th>
                        <th className="p-4 font-medium">Nombre</th>
                        <th className="p-4 font-medium">Categoría</th>
                        <th className="p-4 font-medium">Unidad</th>
                        <th className="p-4 font-medium">Costo</th>
                        <th className="p-4 font-medium">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 dark:divide-stone-700">
                      {parsedData.slice(0, 50).map((row, idx) => (
                        <tr key={idx} className={`bg-white dark:bg-stone-900 ${!row.isValid ? 'bg-rose-50 dark:bg-rose-900/10' : ''}`}>
                          <td className="p-4">
                            {row.isValid ? (
                              <CheckCircle2 size={20} className="text-emerald-500" />
                            ) : (
                              <div className="group relative">
                                <AlertCircle size={20} className="text-rose-500 cursor-help" />
                                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 w-48 bg-stone-900 text-white text-xs rounded p-2 hidden group-hover:block z-10">
                                  {row.errors.join(', ')}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="p-4 font-medium text-stone-900 dark:text-stone-100">{row.name}</td>
                          <td className="p-4 text-stone-600 dark:text-stone-400">{row.category}</td>
                          <td className="p-4 text-stone-600 dark:text-stone-400">{row.unit}</td>
                          <td className="p-4 text-stone-600 dark:text-stone-400">${row.costPerUnit.toLocaleString('es-AR')}</td>
                          <td className="p-4 text-stone-600 dark:text-stone-400">{row.stock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedData.length > 50 && (
                  <div className="p-4 bg-stone-50 dark:bg-stone-800/50 text-center text-sm text-stone-500 dark:text-stone-400 border-t border-stone-200 dark:border-stone-700">
                    Mostrando 50 de {parsedData.length} filas
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 shrink-0 flex justify-end space-x-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors"
          >
            Cancelar
          </button>
          {step === 'review' && (
            <button
              onClick={handleImport}
              disabled={isParsing || parsedData.filter(r => r.isValid).length === 0}
              className="px-6 py-2.5 rounded-xl font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isParsing ? (
                <>
                  <Loader2 size={18} className="animate-spin mr-2" />
                  Importando...
                </>
              ) : (
                `Importar ${parsedData.filter(r => r.isValid).length} Insumos`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
