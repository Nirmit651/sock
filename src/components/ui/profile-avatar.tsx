import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { supabase } from '@/lib/supabase';
import { colors, font } from '@/theme/tokens';

type ProfileAvatarProps = {
  username: string;
  avatarPath?: string | null;
  size?: number;
};

export function ProfileAvatar({ username, avatarPath, size = 44 }: ProfileAvatarProps) {
  const [signed, setSigned] = useState<{ path: string; url: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    if (!avatarPath) return;
    supabase.storage
      .from('avatars')
      .createSignedUrl(avatarPath, 3600)
      .then(({ data }) => active && setSigned({ path: avatarPath, url: data?.signedUrl ?? null }));
    return () => {
      active = false;
    };
  }, [avatarPath]);

  const signedUrl = signed && signed.path === avatarPath ? signed.url : null;

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {signedUrl ? (
        <Image source={{ uri: signedUrl }} contentFit="cover" style={StyleSheet.absoluteFill} />
      ) : (
        <AppText style={[styles.initial, { fontSize: size * 0.38 }]}>
          {username.slice(0, 1).toUpperCase()}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    overflow: 'hidden',
    backgroundColor: colors.lilac,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontFamily: font.bold, color: colors.ink },
});
