import React from "react";
export function Loading({label='Loading...'})
{
    return <div className="state">
                <div className="spinner"/>
                <span>{label}</span>
            </div>
}
export function Empty({title='Nothing here yet',message='There is no data to display.'})
{
    return <div className="state empty">
            <div className="empty-icon">○</div>
            <strong>{title}</strong>
            <span>{message}</span>
            </div>}
export function ErrorState({ message = 'Something went wrong.' }) {
  return (
    <div className="state error">
      <strong>Unable to load</strong>
      <span>{message}</span>
    </div>
  );
}

export function SkeletonLoading({ lines = [100, 75, 100, 60, 100], style, className = "" }) {
  return (
    <div className={`skeleton-container ${className}`.trim()} style={style}>
      {lines.map((w, idx) => (
        <div
          key={idx}
          className="skeleton-line"
          style={{ width: typeof w === "number" ? `${w}%` : w }}
        />
      ))}
    </div>
  );
}
