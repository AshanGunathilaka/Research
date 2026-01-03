import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

// Hook to get themed color based on light/dark mode
export function useThemeColor(props, colorName) {
  const theme = useColorScheme() ?? "light";
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  }

  return Colors[theme][colorName];
}
