import { useState, useCallback } from 'react';
import { z } from 'zod';

interface UseFormOptions<T extends z.ZodType<any>> {
  schema: T;
  defaultValues: z.infer<T>;
  onSubmit: (data: z.infer<T>) => Promise<void> | void;
}

export function useForm<T extends z.ZodType<any>>({
  schema,
  defaultValues,
  onSubmit,
}: UseFormOptions<T>) {
  const [formData, setFormData] = useState<z.infer<T>>(defaultValues);
  const [errors, setErrors] = useState<Partial<Record<keyof z.infer<T>, string>>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = useCallback(
    (field: keyof z.infer<T>) =>
      (value: any) => {
        setFormData((prev) => ({
          ...prev,
          [field]: value,
        }));
        
        // Clear error for this field when user starts typing
        if (errors[field]) {
          setErrors((prev) => ({
            ...prev,
            [field]: undefined,
          }));
        }
      },
    [errors]
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      
      try {
        // Validate form data
        const validatedData = schema.parse(formData);
        
        // Clear all errors
        setErrors({});
        
        // Set loading state
        setIsLoading(true);
        
        // Call onSubmit
        await onSubmit(validatedData);
      } catch (error) {
        if (error instanceof z.ZodError) {
          // Format Zod errors
          const formattedErrors: Partial<Record<keyof z.infer<T>, string>> = {};
          
          error.errors.forEach((err) => {
            const field = err.path[0] as keyof z.infer<T>;
            if (field) {
              formattedErrors[field] = err.message;
            }
          });
          
          setErrors(formattedErrors);
        } else {
          // Rethrow unexpected errors
          throw error;
        }
      } finally {
        setIsLoading(false);
      }
    },
    [formData, schema, onSubmit]
  );

  const resetForm = useCallback(() => {
    setFormData(defaultValues);
    setErrors({});
  }, [defaultValues]);

  const setFieldValue = useCallback(
    (field: keyof z.infer<T>, value: any) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  const setFieldError = useCallback(
    (field: keyof z.infer<T>, error: string | undefined) => {
      setErrors((prev) => ({
        ...prev,
        [field]: error,
      }));
    },
    []
  );

  return {
    formData,
    errors,
    isLoading,
    handleChange,
    handleSubmit,
    resetForm,
    setFieldValue,
    setFieldError,
    setFormData,
    setErrors,
  };
}