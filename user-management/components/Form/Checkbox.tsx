import React, { forwardRef } from 'react';
import { clsx } from 'clsx';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  labelClassName?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      error,
      helperText,
      containerClassName,
      className,
      labelClassName,
      id,
      checked,
      required,
      disabled,
      ...props
    },
    ref
  ) => {
    const checkboxId = id || `checkbox-${props.name || 'checkbox'}`;

    return (
      <div className={clsx('mb-4', containerClassName)}>
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              ref={ref}
              id={checkboxId}
              type="checkbox"
              checked={checked}
              className={clsx(
                'h-4 w-4 rounded border-gray-300 text-blue-600',
                'focus:ring-blue-500 focus:ring-offset-0',
                'disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed',
                error
                  ? 'border-red-300 text-red-600 focus:ring-red-500'
                  : 'border-gray-300',
                className
              )}
              disabled={disabled}
              required={required}
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={
                error ? `${checkboxId}-error` : helperText ? `${checkboxId}-helper` : undefined
              }
              {...props}
            />
          </div>

          {label && (
            <div className="ml-3 text-sm">
              <label
                htmlFor={checkboxId}
                className={clsx(
                  'font-medium',
                  error ? 'text-red-600' : 'text-gray-700',
                  disabled && 'text-gray-400',
                  labelClassName
                )}
              >
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
              </label>
              
              {helperText && !error && (
                <p
                  id={`${checkboxId}-helper`}
                  className="text-gray-500 mt-1"
                >
                  {helperText}
                </p>
              )}
            </div>
          )}
        </div>

        {error && (
          <p
            id={`${checkboxId}-error`}
            className="mt-1 text-sm text-red-600"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;