import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, type StyleProp, type ViewStyle } from "react-native";

export function TabPressFeedback({ pressed, children, style }: { pressed: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (mounted) setReduceMotion(on);
    }, () => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: pressed ? 1 : 0,
      duration: reduceMotion ? 0 : pressed ? 80 : 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [pressed, reduceMotion, progress]);
  return (
    <Animated.View
      style={[style, {
        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.95] }),
        transform: [{ scale: reduceMotion ? 1 : progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.99] }) }],
      }]}
    >
      {children}
    </Animated.View>
  );
}
