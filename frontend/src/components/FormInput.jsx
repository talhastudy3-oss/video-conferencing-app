const FormInput = ({ label, type = 'text', name, value, onChange, error, placeholder, autoComplete }) => (
  <div className="mb-4">
    <label htmlFor={name} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    <input
      id={name}
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 dark:bg-gray-800 dark:text-gray-100 ${
        error
          ? 'border-red-400 focus:ring-red-200'
          : 'border-gray-300 focus:border-brand-500 focus:ring-brand-100 dark:border-gray-600'
      }`}
    />
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
);

export default FormInput;
