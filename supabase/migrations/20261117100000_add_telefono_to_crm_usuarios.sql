-- Agregar columna telefono a CRM_Usuarios
ALTER TABLE public."CRM_Usuarios"
ADD COLUMN IF NOT EXISTS telefono TEXT;

-- Actualizar handle_new_user para considerar telefono desde metadatos
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public."CRM_Usuarios" (id, email, full_name, role, telefono)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'VENDEDOR',
    COALESCE(NEW.raw_user_meta_data->>'telefono', NEW.raw_user_meta_data->>'phone', NULL)
  )
  ON CONFLICT (id) DO UPDATE SET
    telefono = EXCLUDED.telefono
    WHERE "CRM_Usuarios".telefono IS NULL AND EXCLUDED.telefono IS NOT NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
