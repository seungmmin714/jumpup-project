// T-03 — 개발자 패널. `?dev=1` 쿼리로만 노출한다(§8).
// mood 7종 / 연결상태 7종 / 센서 결측을 강제 주입해 하드웨어 없이 전 화면을 검수한다.

import { useEffect, useState } from 'react';
import { getMockClient, isMockMode } from '@/ble';
import { MOOD_ORDER, moodInfo } from '@/lib/mood';
import { useConnectionStore } from '@/store/connectionStore';
import { useTelemetryStore } from '@/store/telemetryStore';
import { uploadQueue, type QueueStatus } from '@/api/uploadQueue';
import { connectPot, disconnectPot } from '@/store/bleBridge';
import { toSoilMoisture } from '@/lib/convert';
import type { ConnectionState, Mood } from '@/ble/types';
import type { MockSnapshot } from '@/ble/MockBleClient';

export function useDevMode(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(new URLSearchParams(window.location.search).get('dev') === '1');
  }, []);
  return on;
}

const STATES: ConnectionState[] = [
  'IDLE',
  'REQUESTING',
  'CONNECTING',
  'CONNECTED',
  'STALE',
  'DISCONNECTED',
  'ERROR',
];

export function DevPanel() {
  const mock = getMockClient();
  const [open, setOpen] = useState(false);
  const [snap, setSnap] = useState<MockSnapshot | null>(mock?.snapshot() ?? null);
  const [queue, setQueue] = useState<QueueStatus | null>(null);

  const conn = useConnectionStore();
  const latest = useTelemetryStore((s) => s.latest);
  const lost = useTelemetryStore((s) => s.lostPackets);
  const dup = useTelemetryStore((s) => s.duplicatePackets);

  useEffect(() => (mock ? mock.onSnapshot(setSnap) : undefined), [mock]);
  useEffect(() => uploadQueue.subscribe(setQueue), []);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-3 z-40 rounded-full bg-neutral-900/85 px-3 py-2 text-xs font-bold text-white shadow-lg"
      >
        DEV
      </button>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-h-[75vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-neutral-900 p-4 text-xs text-neutral-200 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-bold text-white">
          개발자 패널 {isMockMode() ? '· MOCK' : '· REAL'}
        </span>
        <button type="button" className="tap px-2 text-neutral-400" onClick={() => setOpen(false)}>
          닫기 ✕
        </button>
      </div>

      <Section title="현재 상태">
        <Grid>
          <Kv k="conn" v={conn.state} />
          <Kv k="proto" v={String(conn.protoVer ?? '-')} />
          <Kv k="mood" v={latest ? `${latest.mood} ${moodInfo(latest.mood).key}` : '-'} />
          <Kv k="seq" v={String(latest?.seq ?? '-')} />
          <Kv k="soil" v={latest?.soilRaw === null || !latest ? '--' : `${latest.soilRaw} (${latest.soilMoisture}%)`} />
          <Kv k="temp" v={latest?.temperature === null || !latest ? '--' : `${latest.temperature}℃`} />
          <Kv k="lost/dup" v={`${lost}/${dup}`} />
          <Kv k="corrupt" v={`${conn.corruptAt.length}${conn.unstable ? ' ⚠' : ''}`} />
          <Kv k="queue" v={queue ? `${queue.pending}p ${queue.sent}s ${queue.dropped}d` : '-'} />
          <Kv k="ack" v={conn.lastAck ? `${conn.lastAck.cmd}:${conn.lastAck.result}` : '-'} />
        </Grid>
      </Section>

      <Section title="연결">
        <Row>
          <Btn onClick={() => void connectPot()}>connect</Btn>
          <Btn onClick={() => void disconnectPot()}>disconnect</Btn>
        </Row>
      </Section>

      {!mock ? (
        <p className="mt-3 rounded-lg bg-neutral-800 p-3 text-neutral-400">
          실제 BLE 모드입니다. 강제 주입은 <code>VITE_BLE_MODE=mock</code> 또는{' '}
          <code>?ble=mock</code>에서만 가능해요.
        </p>
      ) : (
        <>
          <Section title="mood 강제 주입 (7종)">
            <Row>
              <Btn
                active={snap?.forcedMood === null}
                onClick={() => mock.forceMood(null)}
              >
                auto
              </Btn>
              {MOOD_ORDER.map((m) => (
                <Btn key={m} active={snap?.forcedMood === m} onClick={() => mock.forceMood(m as Mood)}>
                  {m} {moodInfo(m).key}
                </Btn>
              ))}
            </Row>
          </Section>

          <Section title="연결 상태 강제 전이 (7종)">
            <Row>
              {STATES.map((s) => (
                <Btn key={s} active={conn.state === s} onClick={() => mock.forceState(s)}>
                  {s}
                </Btn>
              ))}
            </Row>
          </Section>

          <Section title="센서 결측">
            <Row>
              {(['soil', 'temp', 'humi', 'light'] as const).map((k) => (
                <Btn
                  key={k}
                  active={snap?.missing[k] ?? false}
                  onClick={() => mock.setMissing({ [k]: !(snap?.missing[k] ?? false) })}
                >
                  {k}
                </Btn>
              ))}
              <Btn
                onClick={() =>
                  mock.setMissing({ soil: true, temp: true, humi: true, light: true })
                }
              >
                전부 결측
              </Btn>
              <Btn
                onClick={() =>
                  mock.setMissing({ soil: false, temp: false, humi: false, light: false })
                }
              >
                복구
              </Btn>
            </Row>
          </Section>

          <Section title={`토양 원시값 ${snap?.soilRaw ?? '-'} (${toSoilMoisture(snap?.soilRaw ?? null) ?? '-'}%)`}>
            <input
              type="range"
              min={350}
              max={1023}
              value={snap?.soilRaw ?? 690}
              onChange={(e) => mock.setSoilRaw(Number(e.target.value))}
              className="w-full accent-emerald-400"
            />
            <Row>
              <Btn
                onPointerDown={() => mock.setPouring(true)}
                onPointerUp={() => mock.setPouring(false)}
                onPointerLeave={() => mock.setPouring(false)}
                active={snap?.pouring ?? false}
              >
                💧 물 붓기 (누르고 있기)
              </Btn>
              <Btn onClick={() => mock.setSoilRaw(760)}>건조하게</Btn>
              <Btn onClick={() => mock.setSoilRaw(640)}>목표 구간</Btn>
              <Btn onClick={() => mock.setSoilRaw(520)}>과습</Btn>
            </Row>
          </Section>

          <Section title={`온도 ${((snap?.tempX10 ?? 0) / 10).toFixed(1)}℃`}>
            <Row>
              <Btn onClick={() => mock.setTempX10(80)}>추움 8℃</Btn>
              <Btn onClick={() => mock.setTempX10(235)}>적정 23.5℃</Btn>
              <Btn onClick={() => mock.setTempX10(340)}>더움 34℃</Btn>
            </Row>
          </Section>

          <Section title="프로토콜·손상">
            <Row>
              <Btn active={snap?.protoVer === 3} onClick={() => mock.setProtoVer(3)}>
                protoVer 3
              </Btn>
              <Btn active={snap?.protoVer !== 3} onClick={() => mock.setProtoVer(2)}>
                protoVer 2 (잠금)
              </Btn>
              <Btn onClick={() => mock.injectCorrupt(5)}>손상 5건</Btn>
              <Btn onClick={() => mock.injectCorrupt(21)}>손상 21건 (불안정)</Btn>
            </Row>
          </Section>

          <Section title="기타">
            <Row>
              <Btn onClick={() => uploadQueue.clear()}>큐 비우기</Btn>
              <Kv k="R:1" v={snap?.fastSampling ? 'ON' : 'off'} />
              <Kv k="LED" v={`${snap?.ledPct ?? 0}%`} />
              <Kv k="FAN" v={snap?.fanOn ? 'ON' : 'off'} />
            </Row>
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-3">
      <h3 className="mb-1.5 font-semibold text-neutral-400">{title}</h3>
      {children}
    </section>
  );
}

const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-wrap gap-1.5">{children}</div>
);

const Grid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-2 gap-x-3 gap-y-1">{children}</div>
);

const Kv = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-2 font-mono">
    <span className="text-neutral-500">{k}</span>
    <span className="truncate text-neutral-200">{v}</span>
  </div>
);

function Btn({
  children,
  onClick,
  active,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  onPointerLeave?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      className={`rounded-md px-2 py-1.5 font-semibold transition ${
        active ? 'bg-emerald-500 text-neutral-900' : 'bg-neutral-800 text-neutral-300'
      }`}
    >
      {children}
    </button>
  );
}
