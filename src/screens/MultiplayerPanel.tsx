import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNetStore, prettyCode } from '@/store/useNetStore';
import { useGameStore } from '@/store/useGameStore';
import { palette } from '@/theme/tokens';
import { Divider, Frame, GoldPlate } from '@/ui/Frame';
import { Outlined } from '@/ui/ResourceBar';
import { WorldBackdrop } from '@/ui/WorldBackdrop';

type Tab = 'host' | 'join';

function StepBadge({ n, active }: { n: number; active?: boolean }) {
  return (
    <View
      style={{
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1.5,
        borderColor: active ? palette.gold[300] : palette.gold[700],
        backgroundColor: active ? palette.gold[600] : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Outlined size={9.5} color={active ? '#1a1209' : palette.gold[400]} font="Cinzel_700Bold">
        {n}
      </Outlined>
    </View>
  );
}

function CodeBox({ code, label, testID }: { code: string; label: string; testID?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Outlined size={9} color={palette.gold[300]} font="Cinzel_700Bold" style={{ letterSpacing: 1.2 }}>
          {label}
        </Outlined>
        <Pressable onPress={copy} accessibilityRole="button" accessibilityLabel={`Copy ${label.toLowerCase()}`}>
          <GoldPlate tone="iron" style={{ paddingHorizontal: 8, paddingVertical: 3 }}>
            <Outlined size={9} color={copied ? '#7bf07b' : palette.gold[200]} font="Cinzel_600SemiBold">
              {copied ? 'COPIED' : 'COPY'}
            </Outlined>
          </GoldPlate>
        </Pressable>
      </View>
      <Frame radius={6} gold={0.7} contentStyle={{ padding: 7 }}>
        <ScrollView style={{ maxHeight: 92 }} showsVerticalScrollIndicator={false}>
          <Text
            testID={testID}
            selectable
            style={{
              color: palette.parchment[200],
              fontFamily: 'monospace',
              fontSize: 10,
              lineHeight: 14,
              letterSpacing: 0.4,
            }}
          >
            {prettyCode(code)}
          </Text>
        </ScrollView>
      </Frame>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  busy,
  tone = 'gold',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  tone?: 'gold' | 'ember';
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled || !!busy }}
      style={({ pressed }) => ({ opacity: disabled ? 0.45 : pressed ? 0.85 : 1 })}
    >
      <GoldPlate tone={tone}>
        <LinearGradient colors={['rgba(212,169,66,0.18)', 'transparent']} style={StyleSheet.absoluteFill} />
        <View style={{ paddingVertical: 11, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
          {busy && <ActivityIndicator size="small" color={palette.gold[200]} />}
          <Outlined size={12.5} color={palette.gold[200]} font="Cinzel_700Bold" style={{ letterSpacing: 1.4 }}>
            {label}
          </Outlined>
        </View>
      </GoldPlate>
    </Pressable>
  );
}

export function MultiplayerPanel({ onClose }: { onClose: () => void }) {
  const {
    role,
    status,
    statusDetail,
    peers,
    localCode,
    answerCode,
    error,
    connecting,
    available,
    hostSession,
    createInvite,
    completeJoin,
    prepareJoin,
    leave,
  } = useNetStore();
  const character = useGameStore((s) => s.character);

  const [tab, setTab] = useState<Tab>('host');
  const [joinCode, setJoinCode] = useState('');
  const [answerInput, setAnswerInput] = useState('');

  const identity = { name: character.name, classId: character.classId, level: character.level };

  const startHost = async () => {
    await hostSession(identity);
    await createInvite();
  };

  const startJoin = async () => {
    await prepareJoin(joinCode, identity);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.stone[900] }}>
      <WorldBackdrop dim />
      <View style={{ flex: 1, paddingHorizontal: 14, paddingTop: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <View style={{ flex: 1 }}>
            <Outlined size={15} color={palette.gold[300]} font="Cinzel_700Bold" style={{ letterSpacing: 1.6 }}>
              CO-OP PARTY
            </Outlined>
            <Outlined size={9.5} color={palette.parchment[400]}>
              DIRECT DEVICE-TO-DEVICE · NO SERVERS
            </Outlined>
          </View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close party panel">
            <GoldPlate tone="iron" style={{ width: 44, height: 28, alignItems: 'center', justifyContent: 'center' }}>
              <Outlined size={10} color={palette.gold[200]} font="Cinzel_700Bold">
                CLOSE
              </Outlined>
            </GoldPlate>
          </Pressable>
        </View>

        {!available && (
          <Frame radius={8} accent={palette.ember} style={{ marginBottom: 10 }} contentStyle={{ padding: 8 }}>
            <Outlined size={10} color="#ffb199" align="left">
              WebRTC is unavailable in this preview build. On a device, run `npx expo run:ios` with react-native-webrtc linked.
            </Outlined>
          </Frame>
        )}

        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
          {(['host', 'join'] as Tab[]).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1 }} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
              <View
                style={{
                  paddingVertical: 7,
                  borderRadius: 6,
                  borderWidth: 1.5,
                  borderColor: tab === t ? palette.gold[300] : palette.gold[700],
                  backgroundColor: tab === t ? 'rgba(184,134,43,0.22)' : 'rgba(0,0,0,0.35)',
                  alignItems: 'center',
                }}
              >
                <Outlined size={11} color={tab === t ? palette.gold[200] : palette.parchment[400]} font="Cinzel_700Bold">
                  {t === 'host' ? 'HOST A GAME' : 'JOIN A GAME'}
                </Outlined>
              </View>
            </Pressable>
          ))}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 10, paddingBottom: 14 }} showsVerticalScrollIndicator={false}>
          {tab === 'host' ? (
            <>
              <Frame radius={8} contentStyle={{ padding: 9, gap: 7 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <StepBadge n={1} active={!localCode} />
                  <Outlined size={10.5} color={palette.parchment[200]}>
                    Open a portal and share your code
                  </Outlined>
                </View>
                {!localCode ? (
                  <PrimaryButton label="GENERATE ROOM CODE" onPress={startHost} busy={connecting} />
                ) : (
                  <>
                    <CodeBox code={localCode} label="YOUR ROOM CODE" testID="room-code" />
                    <Divider />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <StepBadge n={2} active />
                      <Outlined size={10.5} color={palette.parchment[200]}>
                        Paste the answer code your friend sends back
                      </Outlined>
                    </View>
                    <TextInput
                      value={answerInput}
                      onChangeText={setAnswerInput}
                      multiline
                      placeholder="Paste the REPLY code here…"
                      placeholderTextColor={palette.parchment[600]}
                      accessibilityLabel="Answer code from friend"
                      style={{
                        color: palette.parchment[100],
                        fontFamily: 'monospace',
                        fontSize: 10,
                        minHeight: 56,
                        borderWidth: 1,
                        borderColor: palette.gold[700],
                        borderRadius: 5,
                        padding: 6,
                        backgroundColor: 'rgba(0,0,0,0.4)',
                      }}
                    />
                    <PrimaryButton
                      label="LINK PARTY MEMBER"
                      onPress={() => completeJoin(answerInput, identity)}
                      disabled={answerInput.trim().length < 20}
                      busy={connecting}
                    />
                  </>
                )}
              </Frame>
            </>
          ) : (
            <>
              <Frame radius={8} contentStyle={{ padding: 9, gap: 7 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <StepBadge n={1} active={!answerCode} />
                  <Outlined size={10.5} color={palette.parchment[200]}>
                    Paste the host's room code
                  </Outlined>
                </View>
                <TextInput
                  value={joinCode}
                  onChangeText={setJoinCode}
                  multiline
                  placeholder="Paste the ROOM code here…"
                  placeholderTextColor={palette.parchment[600]}
                  accessibilityLabel="Host room code"
                  style={{
                    color: palette.parchment[100],
                    fontFamily: 'monospace',
                    fontSize: 10,
                    minHeight: 56,
                    borderWidth: 1,
                    borderColor: palette.gold[700],
                    borderRadius: 5,
                    padding: 6,
                    backgroundColor: 'rgba(0,0,0,0.4)',
                  }}
                />
                {!answerCode ? (
                  <PrimaryButton
                    label="REQUEST TO JOIN"
                    onPress={startJoin}
                    disabled={joinCode.trim().length < 20}
                    busy={connecting}
                  />
                ) : (
                  <>
                    <Divider />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <StepBadge n={2} active />
                      <Outlined size={10.5} color={palette.parchment[200]}>
                        Send this reply code back to the host
                      </Outlined>
                    </View>
                    <CodeBox code={answerCode} label="YOUR REPLY CODE" testID="reply-code" />
                  </>
                )}
              </Frame>
            </>
          )}

          <Frame radius={8} contentStyle={{ padding: 9 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Outlined size={9.5} color={palette.gold[300]} font="Cinzel_700Bold" style={{ letterSpacing: 1.2 }}>
                PARTY ROSTER
              </Outlined>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor:
                      status === 'connected' ? '#59d16a' : status === 'waiting' ? '#e8c66a' : '#8a7a5a',
                  }}
                />
                <Outlined size={9} color={palette.parchment[300]}>
                  {(status === 'connected' ? 'CONNECTED' : status === 'waiting' ? 'AWAITING PARTY' : status.toUpperCase()) +
                    (role !== 'solo' ? ` · ${role.toUpperCase()}` : '')}
                </Outlined>
              </View>
            </View>
            <Divider style={{ marginVertical: 6 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: palette.gold[300] }} />
              <Outlined size={10.5} color={palette.gold[200]}>
                {character.name} (you)
              </Outlined>
              <View style={{ flex: 1 }} />
              <Outlined size={9} color={palette.parchment[400]}>
                {character.classId.toUpperCase()} · LV {character.level}
              </Outlined>
            </View>
            {peers.length === 0 ? (
              <Outlined size={10} color={palette.parchment[500]} style={{ paddingVertical: 4 }}>
                No one else in the party yet.
              </Outlined>
            ) : (
              peers.map((p) => (
                <View key={p.peerId} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 }}>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#59d16a' }} />
                  <Outlined size={10.5} color={palette.parchment[100]}>
                    {p.name}
                  </Outlined>
                  <View style={{ flex: 1 }} />
                  <Outlined size={9} color={palette.parchment[400]}>
                    {p.classId.toUpperCase()} · LV {p.level}
                  </Outlined>
                </View>
              ))
            )}
          </Frame>

          {statusDetail ? (
            <Outlined size={9.5} color={palette.parchment[400]} align="center">
              {statusDetail}
            </Outlined>
          ) : null}
          {error ? (
            <Outlined size={10} color="#ff8f7a" align="center">
              {error}
            </Outlined>
          ) : null}

          {(localCode || answerCode || role !== 'solo') && (
            <Pressable
              onPress={() => {
                leave();
                setJoinCode('');
                setAnswerInput('');
              }}
              accessibilityRole="button"
              accessibilityLabel="Leave party"
            >
              <View style={{ paddingVertical: 8, alignItems: 'center' }}>
                <Outlined size={10} color="#c97b62" font="Cinzel_600SemiBold" style={{ letterSpacing: 1 }}>
                  LEAVE PARTY
                </Outlined>
              </View>
            </Pressable>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
