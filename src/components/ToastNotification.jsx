import React from 'react';

export default function ToastNotification({ notice, onMore }) {
  if (!notice) return null;
  return (
    <div className="kronoxNotice" aria-live="assertive" aria-atomic="true" key={notice.id}>
      <b>{notice.title}</b>
      <p>{notice.text}</p>
      {notice.planet && (
        <button onClick={() => onMore(notice.planet)}>¿Quieres saber más? Dale aquí</button>
      )}
    </div>
  );
}
