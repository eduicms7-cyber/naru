import React from 'react';
import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface IconProps {
  size: number;
  color: string;
}

// 수정 버튼용 몽땅연필. 별도 아이콘이 없어서 MaterialCommunityIcons의 'lead-pencil'(대각선 연필)을
// 연필 축 방향으로만 눌러 짧고 뭉툭하게 만든다 — 45° 돌려 가로로 눕힌 뒤 X축만 줄이고 다시 세운다.
export function StubPencilIcon({ size, color }: IconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <MaterialCommunityIcons
        name="lead-pencil"
        // 축 방향으로 60%만 남기므로 원본을 키워서 옆 아이콘들과 시각적 크기를 맞춘다.
        size={size * 1.4}
        color={color}
        style={{ transform: [{ rotate: '-45deg' }, { scaleX: 0.6 }, { rotate: '45deg' }] }}
      />
    </View>
  );
}

// 매일 복습 고정(dailyPin)용 압정.
export function PushPinIcon({ size, color, active }: IconProps & { active: boolean }) {
  return <MaterialCommunityIcons name={active ? 'pin' : 'pin-outline'} size={size} color={color} />;
}
