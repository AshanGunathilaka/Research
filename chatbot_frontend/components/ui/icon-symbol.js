import MaterialIcons from "@expo/vector-icons/MaterialIcons";

// Fallback for using MaterialIcons on Android and web.

const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
};

// An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
export function IconSymbol({ name, size = 24, color, style, weight }) {
  return (
    <MaterialIcons
      color={color}
      size={size}
      name={MAPPING[name]}
      style={style}
    />
  );
}
