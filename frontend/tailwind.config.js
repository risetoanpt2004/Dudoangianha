/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#153D72",
        primary: "#2563EB",
        ink: "#172B4D",
        canvas: "#F3F5F9",
        success: "#16A34A",
      },
    },
  },
  plugins: [],
};
