
-- Add new payment methods
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'nequi';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'daviplata';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'gift';
