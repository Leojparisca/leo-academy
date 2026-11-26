module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: { extend: { colors: { abyss: "#06080F", electric: "#0D6EFD", cyan: "#38BDF8", ink: "#F8FAFC" } } },
  plugins: []
};
