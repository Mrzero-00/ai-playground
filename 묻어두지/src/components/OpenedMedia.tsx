import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { MediaAttachment } from '../shared/contracts';
import { createPlaybackFile, type PlaybackFile } from '../lib/media';
import MediaPlayback from './MediaPlayback';

export default function OpenedMedia({ kind, attachment }: { kind: 'audio' | 'video'; attachment: MediaAttachment }) {
  const [file, setFile] = useState<PlaybackFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let prepared: PlaybackFile | null = null;
    setFile(null); setError(null);
    void createPlaybackFile(attachment).then(async result => {
      if (!alive) { await result.dispose(); return; }
      prepared = result; setFile(result);
    }).catch(() => { if (alive) setError('파일을 준비하지 못했어요. 캡슐을 닫고 다시 열어 주세요.'); });
    return () => { alive = false; if (prepared) void prepared.dispose(); };
  }, [attachment]);
  return <View style={styles.frame}>{file
    ? <MediaPlayback key={file.uri} kind={kind} uri={file.uri} label={attachment.fileName}/>
    : error ? <Text style={styles.message}>{error}</Text> : <View style={styles.loading}><ActivityIndicator color="#4e6946"/><Text style={styles.message}>{kind === 'audio' ? '목소리' : '영상'}를 꺼내는 중이에요.</Text></View>
  }</View>;
}
const styles = StyleSheet.create({ frame: { marginTop: 20 }, loading: { padding: 20, gap: 10, alignItems: 'center' }, message: { fontSize: 12, color: '#6c775f', lineHeight: 20 } });
