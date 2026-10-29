export type UserRole =
  | "patient"
  | "compounder"
  | "doctor"
  | "admin"
  | "admin_doctor";

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  age: number | null;
  sex: "male" | "female" | "other" | null;
  address: string | null;
  role: UserRole;
  created_at: string | null;
  updated_at: string | null;
};

export type DentalService = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  base_price: number;
  category: string | null;
  is_tooth_based: boolean;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type Doctor = {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  speciality: string | null;
  bio: string | null;
  consultation_fee: number;
  photo_url: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type DoctorSchedule = {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "in_consultation"
  | "completed"
  | "cancelled";

export type Appointment = {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
  status: AppointmentStatus;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type AvailableSlot = {
  start_time: string;
  end_time: string;
};
export type PatientPrecheck = {
  id: string;
  appointment_id: string;
  patient_id: string;
  checked_by: string | null;
  blood_pressure: string | null;
  pulse: string | null;
  temperature: string | null;
  weight: string | null;
  allergy: string | null;
  pregnancy_status: string | null;
  diabetes: boolean;
  heart_disease: boolean;
  current_medication: string | null;
  pain_level: number | null;
  medical_warning: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};
export type Consultation = {
  id: string;
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  diagnosis: string | null;
  treatment_plan: string | null;
  doctor_notes: string | null;
  total_amount: number;
  created_at: string | null;
  updated_at: string | null;
};

export type ConsultationService = {
  id: string;
  consultation_id: string;
  tooth_number: string | null;
  service_id: string | null;
  service_name: string;
  price: number;
  note: string | null;
  created_at: string | null;
};
export type Agreement = {
  id: string;
  consultation_id: string;
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  agreement_text: string | null;
  patient_signature: string | null;
  signed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};
export type InvoiceStatus = "unpaid" | "partial" | "paid" | "cancelled";

export type Invoice = {
  id: string;
  consultation_id: string;
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  subtotal_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  status: InvoiceStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type PaymentMethod =
  | "cash"
  | "card"
  | "mobile_banking"
  | "bank_transfer"
  | "other";

export type Payment = {
  id: string;
  invoice_id: string;
  patient_id: string;
  amount: number;
  payment_method: PaymentMethod;
  transaction_reference: string | null;
  note: string | null;
  received_by: string | null;
  created_at: string | null;
};