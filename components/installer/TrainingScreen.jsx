'use client';
// Installer app → Training. Product-by-product how-to videos (installation + setup), played inline.
// Kept deliberately quiet: one card per product, two rows each; tap a row and the player opens right
// under it (one at a time). The list lives in lib/installerTraining.js. Each row also has an
// "Open in YouTube" link, since some in-app webviews are fussy about embedded players.
import { useState } from 'react';
import { ScreenHeader, useAppBase } from '@/components/partner/ui';
import { IconPlay } from '@/components/partner/icons';
import { TRAINING } from '@/lib/installerTraining';

const embedUrl = (id) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1&modestbranding=1`;
const watchUrl = (id) => `https://www.youtube.com/watch?v=${id}`;
const thumbUrl = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

function VideoRow({ product, video, open, onToggle }) {
  const [thumbOk, setThumbOk] = useState(true);
  return (
    <div className="hp-vid">
      <button type="button" className="hp-vid-row" onClick={onToggle} aria-expanded={open}>
        <span className="hp-vid-thumb">
          {thumbOk && <img src={thumbUrl(video.id)} alt="" loading="lazy" onError={() => setThumbOk(false)} />}
          <span className="hp-vid-play"><IconPlay size={14} /></span>
        </span>
        <span className="hp-vid-text">
          <span className="hp-vid-kind">{video.kind}</span>
          <span className="hp-vid-sub">{product} · {open ? 'Playing' : 'Tap to watch'}</span>
        </span>
      </button>
      {open && (
        <div className="hp-vid-player">
          <div className="hp-vid-frame">
            <iframe
              src={embedUrl(video.id)}
              title={`${product} ${video.kind}`}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <a className="hp-vid-ext" href={watchUrl(video.id)} target="_blank" rel="noopener noreferrer">Open in YouTube</a>
        </div>
      )}
    </div>
  );
}

export default function TrainingScreen() {
  const base = useAppBase();
  const [playing, setPlaying] = useState(null); // `${productKey}:${videoId}`
  return (
    <>
      <ScreenHeader title="Training" backHref={`${base}/home?tab=profile`} />
      <div style={{ padding: '0 16px 24px' }}>
        <div style={{ fontSize: 13, color: 'var(--hp-text-soft)', lineHeight: 1.6, margin: '0 2px 12px' }}>
          Short videos on how to install and set up each Heseos product.
        </div>
        {TRAINING.map((p) => (
          <div className="hp-card" key={p.key}>
            <div className="hp-card-title">{p.product}</div>
            {p.videos.map((v) => {
              const k = `${p.key}:${v.id}`;
              return (
                <VideoRow key={k} product={p.product} video={v} open={playing === k} onToggle={() => setPlaying(playing === k ? null : k)} />
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
