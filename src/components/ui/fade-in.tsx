import { useEffect, useState, type PropsWithChildren } from 'react';
import { Animated } from 'react-native';

export function FadeIn({ children, delay = 0 }: PropsWithChildren<{ delay?: number }>) {
  const [value] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(value, {
      toValue: 1,
      duration: 380,
      delay,
      useNativeDriver: true,
    }).start();
  }, [delay, value]);

  return (
    <Animated.View
      style={{
        opacity: value,
        transform: [
          { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
