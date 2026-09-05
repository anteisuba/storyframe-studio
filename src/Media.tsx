import {
  type Asset,
  titleOf,
  categoryLabel,
  isVideo,
  isAudio,
  sizeLabel,
} from "./model";
import { AudioPreview } from './AudioPreview';
export function Preview({
  asset: a,
  controls = false,
}: {
  asset: Asset;
  controls?: boolean;
}) {
  if (isAudio(a)) return <AudioPreview asset={a} controls={controls} />;
  if (isVideo(a))
    return controls ? (
      <video
        aria-label={"播放 " + titleOf(a)}
        controls
        playsInline
        preload="metadata"
        src={a.url + "#t=0.1"}
      />
    ) : (
      <video
        aria-label={titleOf(a)}
        muted
        playsInline
        preload="metadata"
        src={a.url + "#t=0.1"}
      />
    );
  return <img src={a.url} loading="lazy" alt={titleOf(a)} />;
}
export function AssetCard({
  asset: a,
  selected,
  onSelect,
  onOpen,
}: {
  asset: Asset;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  return (
    <div className={"asset-card " + (selected ? "checked" : "")}>
      <div className="card-preview">
        {isVideo(a) || isAudio(a) ? (
          <Preview asset={a} controls />
        ) : (
          <button
            className="preview-button"
            onClick={onOpen}
            aria-label={"查看 " + titleOf(a)}
          >
            <Preview asset={a} />
          </button>
        )}
        <input
          type="checkbox"
          aria-label={"选择 " + titleOf(a)}
          checked={selected}
          onChange={onSelect}
        />
        <span className="type-tag">{categoryLabel(a)}</span>
      </div>
      <button className="card-caption" onClick={onOpen}>
        <strong>{titleOf(a)}</strong>
        <span>
          <i className={a.blocked ? "dot blocked" : "dot"} />
          {a.blocked ? "历史版本" : a.status ? "已有状态" : "待整理"}
          <small>{sizeLabel(a.bytes)}</small>
        </span>
      </button>
    </div>
  );
}
