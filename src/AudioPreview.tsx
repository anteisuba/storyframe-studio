import { useEffect, useState } from 'react';
import { type Asset, titleOf } from './model';

const waveforms = new Map<string, Promise<number[]>>();
function waveform(url: string) {
  if (!waveforms.has(url)) {
    const task = (async () => {
      const response = await fetch(url);
      if (!response.ok) throw Error('音频加载失败');
      const bytes = await response.arrayBuffer();
      const context = new AudioContext();
      try {
        const buffer = await context.decodeAudioData(bytes);
        const samples = buffer.getChannelData(0);
        const peaks = Array.from({ length: 80 }, (_, i) => {
          let peak = 0;
          const end = Math.floor((i + 1) * samples.length / 80);
          for (let j = Math.floor(i * samples.length / 80); j < end; j++) peak = Math.max(peak, Math.abs(samples[j]));
          return peak;
        });
        const maximum = Math.max(...peaks, 0.001);
        return peaks.map(p => p / maximum);
      } finally { await context.close(); }
    })();
    waveforms.set(url, task);
    task.catch(() => waveforms.delete(url));
  }
  return waveforms.get(url)!;
}

export function AudioPreview({ asset, controls }: { asset: Asset; controls: boolean }) {
  const [peaks, setPeaks] = useState<number[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setPeaks([]); setFailed(false);
    waveform(asset.url).then(p => { if (active) setPeaks(p); }, () => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [asset.url]);
  return <div className="audio-wave-preview">
    {peaks.length ? <svg viewBox="0 0 320 90" role="img" aria-label={titleOf(asset) + '真实音频波形'}>
      {peaks.map((p, i) => <rect key={i} x={i * 4} y={45 - Math.max(2, p * 72) / 2} width="2.5" height={Math.max(2, p * 72)} rx="1.2" />)}
    </svg> : <span>{failed ? '波形暂不可用' : '正在读取波形…'}</span>}
    {controls && <audio aria-label={'播放 ' + titleOf(asset)} controls preload="metadata" src={asset.url} />}
  </div>;
}
