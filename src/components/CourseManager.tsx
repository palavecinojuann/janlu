import React, { useState } from 'react';
import { Course, Sale, Customer } from '../types';
import { GraduationCap, Users, Calendar, Plus, Edit2, Trash2, MapPin, Check, X, Clock, Upload, Loader2, User, Phone, Mail, ExternalLink } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';

interface CourseManagerProps {
  courses: Course[];
  sales: Sale[];
  customers: Customer[];
  onAddCourse: (course: Course) => Promise<void>;
  onUpdateCourse: (course: Course) => Promise<void>;
  onDeleteCourse: (id: string) => Promise<void>;
}

export const CourseManager: React.FC<CourseManagerProps> = ({
  courses,
  sales,
  customers,
  onAddCourse,
  onUpdateCourse,
  onDeleteCourse
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEnrollmentModalOpen, setIsEnrollmentModalOpen] = useState(false);
  const [selectedCourseForEnrollment, setSelectedCourseForEnrollment] = useState<Course | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [formData, setFormData] = useState<Partial<Course>>({
    title: '',
    description: '',
    date: '',
    price: 0,
    maxQuota: 0,
    enrolledCount: 0,
    location: '',
    isActive: true,
    imageUrl: ''
  });

  const handleOpenModal = (course?: Course) => {
    if (course) {
      setEditingCourse(course);
      setFormData(course);
    } else {
      setEditingCourse(null);
      setFormData({
        title: '',
        description: '',
        date: '',
        price: 0,
        maxQuota: 0,
        enrolledCount: 0,
        location: '',
        isActive: true,
        imageUrl: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenEnrollmentModal = (course: Course) => {
    setSelectedCourseForEnrollment(course);
    setIsEnrollmentModalOpen(true);
  };

  const getEnrolledCustomers = (courseId: string) => {
    const enrolledSales = sales.filter(sale => 
      sale.status !== 'cancelado' && 
      sale.items.some(item => item.isCourse && item.courseId === courseId)
    );

    return enrolledSales.map(sale => {
      const customer = customers.find(c => c.id === sale.customerId);
      const courseItem = sale.items.find(item => item.isCourse && item.courseId === courseId);
      
      return {
        saleId: sale.id,
        orderNumber: sale.orderNumber,
        date: sale.date,
        status: sale.status,
        quantity: courseItem?.quantity || 1,
        customerName: customer?.name || sale.customerName || 'Cliente Invitado',
        customerEmail: customer?.email || sale.customerEmail || 'N/A',
        customerPhone: customer?.phone || sale.customerPhone || 'N/A'
      };
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800000) { // Limit to ~800KB for Firestore
      alert('La imagen es demasiado grande. Por favor, elige una de menos de 800KB.');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, imageUrl: reader.result as string });
      setIsUploading(false);
    };
    reader.onerror = () => {
      alert('Error al procesar la imagen');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCourse) {
        await onUpdateCourse({ ...editingCourse, ...formData } as Course);
      } else {
        await onAddCourse({
          ...formData,
          id: uuidv4(),
          enrolledCount: 0
        } as Course);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving course:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este curso?')) {
      await onDeleteCourse(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-serif text-stone-900">Workshops y Cursos</h2>
          <p className="text-stone-500 text-sm">Gestiona tus capacitaciones y eventos</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-stone-900 text-white px-6 py-2.5 rounded-full hover:bg-stone-800 transition-all shadow-sm"
        >
          <Plus size={18} />
          <span>Crear Nuevo Curso</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <motion.div
            layout
            key={course.id}
            className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden group hover:shadow-md transition-all flex flex-col"
          >
            {course.imageUrl && (
              <div className="h-40 overflow-hidden relative">
                <img
                  src={course.imageUrl}
                  alt={course.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                {!course.isActive && (
                  <div className="absolute inset-0 bg-stone-900/40 flex items-center justify-center">
                    <span className="bg-white/90 text-stone-900 px-3 py-1 rounded-full text-xs font-medium">Inactivo</span>
                  </div>
                )}
              </div>
            )}
            <div className="p-5 space-y-4 flex-1 flex flex-col">
              <div className="flex justify-between items-start">
                <h3 className="font-medium text-stone-900 text-lg leading-tight">{course.title}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenModal(course)}
                    className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-50 rounded-full transition-all"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(course.id)}
                    className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm text-stone-600">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-stone-400" />
                  <span>{new Date(course.date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-stone-400" />
                  <span>{new Date(course.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-stone-400" />
                  <span>{course.location || 'Ubicación a definir'}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-stone-50 mt-auto">
                <div className="flex justify-between items-end mb-2">
                  <div className="space-y-1">
                    <span className="text-xs text-stone-400 uppercase tracking-wider">Cupos</span>
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-stone-400" />
                      <span className={`font-medium ${course.enrolledCount >= course.maxQuota ? 'text-red-600' : 'text-stone-900'}`}>
                        {course.enrolledCount} / {course.maxQuota}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-stone-400 uppercase tracking-wider">Precio</span>
                    <div className="text-lg font-serif text-stone-900">
                      ${course.price.toLocaleString('es-AR')}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden mb-4">
                  <div
                    className={`h-full transition-all duration-500 ${
                      course.enrolledCount >= course.maxQuota ? 'bg-red-500' : 'bg-stone-900'
                    }`}
                    style={{ width: `${Math.min((course.enrolledCount / course.maxQuota) * 100, 100)}%` }}
                  />
                </div>

                <button
                  onClick={() => handleOpenEnrollmentModal(course)}
                  className="w-full py-2 bg-stone-50 text-stone-600 rounded-xl hover:bg-stone-100 transition-all text-xs font-medium flex items-center justify-center gap-2"
                >
                  <Users size={14} />
                  Ver Inscriptos
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Enrollment List Modal */}
      <AnimatePresence>
        {isEnrollmentModalOpen && selectedCourseForEnrollment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEnrollmentModalOpen(false)}
              className="absolute inset-0 bg-stone-900/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                <div>
                  <h3 className="text-xl font-serif text-stone-900">
                    Inscriptos: {selectedCourseForEnrollment.title}
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">
                    {selectedCourseForEnrollment.enrolledCount} personas registradas de {selectedCourseForEnrollment.maxQuota} cupos
                  </p>
                </div>
                <button
                  onClick={() => setIsEnrollmentModalOpen(false)}
                  className="p-2 hover:bg-white rounded-full transition-all text-stone-400 hover:text-stone-900"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {getEnrolledCustomers(selectedCourseForEnrollment.id).length > 0 ? (
                  <div className="space-y-4">
                    {getEnrolledCustomers(selectedCourseForEnrollment.id).map((enrollment, idx) => (
                      <div key={enrollment.saleId + idx} className="p-4 bg-stone-50 rounded-2xl border border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-stone-200 rounded-full flex items-center justify-center text-stone-500">
                            <User size={20} />
                          </div>
                          <div>
                            <h4 className="font-medium text-stone-900">{enrollment.customerName}</h4>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                              <div className="flex items-center gap-1 text-xs text-stone-500">
                                <Mail size={12} />
                                {enrollment.customerEmail}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-stone-500">
                                <Phone size={12} />
                                {enrollment.customerPhone}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0">
                          <div className="text-right">
                            <p className="text-[10px] text-stone-400 uppercase tracking-wider">Lugares</p>
                            <p className="font-medium text-stone-900">{enrollment.quantity}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-stone-400 uppercase tracking-wider">Orden</p>
                            <p className="font-medium text-stone-900">#{enrollment.orderNumber || enrollment.saleId.slice(0, 5)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-stone-400 uppercase tracking-wider">Estado</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              enrollment.status === 'entregado' ? 'bg-emerald-100 text-emerald-700' :
                              enrollment.status === 'cancelado' ? 'bg-red-100 text-red-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {enrollment.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users size={48} className="mx-auto text-stone-200 mb-4" />
                    <p className="text-stone-500">Aún no hay inscriptos para este curso.</p>
                  </div>
                )}
              </div>
              
              <div className="p-6 border-t border-stone-100 bg-stone-50/30 flex justify-end">
                <button
                  onClick={() => setIsEnrollmentModalOpen(false)}
                  className="px-6 py-2 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-all font-medium text-sm"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Form */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-stone-900/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                <h3 className="text-xl font-serif text-stone-900">
                  {editingCourse ? 'Editar Curso' : 'Nuevo Curso'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-white rounded-full transition-all text-stone-400 hover:text-stone-900"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-500 uppercase ml-1">Título del Curso</label>
                  <input
                    required
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 outline-none transition-all"
                    placeholder="Ej: Workshop de Cerámica Inicial"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-500 uppercase ml-1">Descripción</label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 outline-none transition-all min-h-[100px]"
                    placeholder="Describe de qué trata el curso..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-stone-500 uppercase ml-1">Fecha y Hora</label>
                    <input
                      required
                      type="datetime-local"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-stone-500 uppercase ml-1">Precio</label>
                    <input
                      required
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-stone-500 uppercase ml-1">Cupo Máximo</label>
                    <input
                      required
                      type="number"
                      value={formData.maxQuota}
                      onChange={(e) => setFormData({ ...formData, maxQuota: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-stone-500 uppercase ml-1">Ubicación / Modalidad</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 outline-none transition-all"
                      placeholder="Ej: Palermo, CABA o Online"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-500 uppercase ml-1">Imagen del Curso</label>
                  <div className="flex flex-col gap-3">
                    {formData.imageUrl && (
                      <div className="relative w-full h-32 rounded-xl overflow-hidden border border-stone-200">
                        <img 
                          src={formData.imageUrl} 
                          alt="Preview" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, imageUrl: '' })}
                          className="absolute top-2 right-2 p-1 bg-white/90 rounded-full text-red-600 shadow-sm hover:bg-white"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          id="course-image-upload"
                        />
                        <label
                          htmlFor="course-image-upload"
                          className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl cursor-pointer hover:bg-stone-100 transition-all text-sm font-medium text-stone-600 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                          {isUploading ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <Upload size={18} />
                          )}
                          <span>{formData.imageUrl ? 'Cambiar Imagen' : 'Subir Imagen'}</span>
                        </label>
                      </div>
                      <div className="flex-[2]">
                        <input
                          type="url"
                          value={formData.imageUrl}
                          onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                          className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 outline-none transition-all text-sm"
                          placeholder="O pega una URL de imagen..."
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-stone-400 px-1">
                      Recomendado: Imagen cuadrada o 16:9, máx 800KB.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`w-12 h-6 rounded-full transition-all relative ${formData.isActive ? 'bg-stone-900' : 'bg-stone-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.isActive ? 'left-7' : 'left-1'}`} />
                  </button>
                  <span className="text-sm text-stone-600 font-medium">Curso Activo (Visible en catálogo)</span>
                </div>

                <div className="pt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-3 border border-stone-200 text-stone-600 rounded-xl hover:bg-stone-50 transition-all font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-all font-medium shadow-sm"
                  >
                    {editingCourse ? 'Guardar Cambios' : 'Crear Curso'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
