export function Button({ children, className = "", variant = "default", ...props }) {
  const baseClasses = "font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-4";
  
  const variants = {
    default: "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-200 shadow-md hover:shadow-lg",
    outline: "bg-white text-indigo-600 border-2 border-indigo-200 hover:bg-indigo-50 focus:ring-indigo-200 shadow-sm hover:shadow-md"
  };

  const variantClasses = variants[variant] || variants.default;

  return (
    <button
      {...props}
      className={`px-6 py-3 ${baseClasses} ${variantClasses} ${className}`}
    >
      {children}
    </button>
  );
}