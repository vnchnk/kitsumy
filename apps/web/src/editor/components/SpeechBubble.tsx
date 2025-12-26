import React from 'react';

interface SpeechBubbleProps {
  width: number;
  height: number;
  text: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  borderWidth: number;
  fontSize: number;
  tailPosition: 'bottom-left' | 'bottom-center' | 'bottom-right' | 'top-left' | 'top-center' | 'top-right' | 'none';
  style: 'speech' | 'thought' | 'shout';
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({
  width,
  height,
  text,
  textColor,
  bgColor,
  borderColor,
  borderWidth,
  fontSize,
  tailPosition,
  style,
}) => {
  const padding = 12;
  const tailHeight = 20;
  const tailWidth = 30;

  // Adjust bubble height to account for tail
  const bubbleH = tailPosition === 'none' ? height : height - tailHeight;

  // Calculate tail position
  const getTailX = () => {
    if (tailPosition.includes('left')) return width * 0.2;
    if (tailPosition.includes('right')) return width * 0.8 - tailWidth;
    return width / 2 - tailWidth / 2;
  };

  // Speech bubble - smooth rounded rectangle with tail
  const renderSpeechBubble = () => {
    const r = Math.min(20, bubbleH * 0.3); // border radius
    const tailX = getTailX();
    const isBottom = tailPosition.startsWith('bottom') || !tailPosition.startsWith('top');

    // Main bubble path with integrated tail
    let path = '';

    if (tailPosition === 'none') {
      // Simple rounded rect
      path = `
        M ${r},0
        L ${width - r},0
        Q ${width},0 ${width},${r}
        L ${width},${bubbleH - r}
        Q ${width},${bubbleH} ${width - r},${bubbleH}
        L ${r},${bubbleH}
        Q 0,${bubbleH} 0,${bubbleH - r}
        L 0,${r}
        Q 0,0 ${r},0
        Z
      `;
    } else if (isBottom) {
      // Rounded rect with bottom tail
      path = `
        M ${r},0
        L ${width - r},0
        Q ${width},0 ${width},${r}
        L ${width},${bubbleH - r}
        Q ${width},${bubbleH} ${width - r},${bubbleH}
        L ${tailX + tailWidth},${bubbleH}
        L ${tailX + tailWidth * 0.5},${height}
        L ${tailX},${bubbleH}
        L ${r},${bubbleH}
        Q 0,${bubbleH} 0,${bubbleH - r}
        L 0,${r}
        Q 0,0 ${r},0
        Z
      `;
    } else {
      // Rounded rect with top tail
      path = `
        M ${r},${tailHeight}
        L ${tailX},${tailHeight}
        L ${tailX + tailWidth * 0.5},0
        L ${tailX + tailWidth},${tailHeight}
        L ${width - r},${tailHeight}
        Q ${width},${tailHeight} ${width},${tailHeight + r}
        L ${width},${height - r}
        Q ${width},${height} ${width - r},${height}
        L ${r},${height}
        Q 0,${height} 0,${height - r}
        L 0,${tailHeight + r}
        Q 0,${tailHeight} ${r},${tailHeight}
        Z
      `;
    }

    return (
      <path
        d={path}
        fill={bgColor}
        stroke={borderColor}
        strokeWidth={borderWidth}
        strokeLinejoin="round"
      />
    );
  };

  // Thought bubble - cloud shape with small circles as tail
  const renderThoughtBubble = () => {
    const cx = width / 2;
    const cy = bubbleH / 2;
    const rx = width / 2 - borderWidth;
    const ry = bubbleH / 2 - borderWidth;

    const tailX = getTailX() + tailWidth / 2;
    const isBottom = !tailPosition.startsWith('top');

    return (
      <>
        {/* Main ellipse */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          fill={bgColor}
          stroke={borderColor}
          strokeWidth={borderWidth}
        />
        {/* Thought tail - small circles */}
        {tailPosition !== 'none' && (
          <>
            <circle
              cx={tailX}
              cy={isBottom ? bubbleH + 8 : -8}
              r={6}
              fill={bgColor}
              stroke={borderColor}
              strokeWidth={borderWidth}
            />
            <circle
              cx={tailX + (tailPosition.includes('left') ? 5 : -5)}
              cy={isBottom ? bubbleH + 18 : -18}
              r={4}
              fill={bgColor}
              stroke={borderColor}
              strokeWidth={borderWidth}
            />
          </>
        )}
      </>
    );
  };

  // Shout bubble - spiky starburst shape
  const renderShoutBubble = () => {
    const cx = width / 2;
    const cy = height / 2;
    const outerRx = width / 2 - borderWidth;
    const outerRy = height / 2 - borderWidth;
    const innerRx = outerRx * 0.75;
    const innerRy = outerRy * 0.75;
    const spikes = 12;

    let points = '';
    for (let i = 0; i < spikes; i++) {
      const angle = (i / spikes) * 2 * Math.PI - Math.PI / 2;
      const nextAngle = ((i + 0.5) / spikes) * 2 * Math.PI - Math.PI / 2;

      // Outer point (spike)
      const ox = cx + outerRx * Math.cos(angle);
      const oy = cy + outerRy * Math.sin(angle);

      // Inner point (between spikes)
      const ix = cx + innerRx * Math.cos(nextAngle);
      const iy = cy + innerRy * Math.sin(nextAngle);

      points += `${ox},${oy} ${ix},${iy} `;
    }

    return (
      <polygon
        points={points.trim()}
        fill={bgColor}
        stroke={borderColor}
        strokeWidth={borderWidth}
        strokeLinejoin="round"
      />
    );
  };

  return (
    <div className="absolute inset-0" style={{ overflow: 'visible' }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ overflow: 'visible' }}
      >
        {style === 'speech' && renderSpeechBubble()}
        {style === 'thought' && renderThoughtBubble()}
        {style === 'shout' && renderShoutBubble()}
      </svg>

      {/* Text overlay - always centered within bubble body (excluding tail) */}
      <div
        className="absolute flex items-center justify-center text-center"
        style={{
          // Position text area exactly within the bubble body
          // bubbleH = height of bubble body (without tail)
          // For bottom tail: body is y=0 to y=bubbleH, text centered within
          // For top tail: body is y=tailHeight to y=height, text centered within
          top: style === 'speech' && tailPosition.startsWith('top') ? tailHeight + padding : padding,
          left: padding,
          right: padding,
          // Height is always bubbleH - 2*padding, positioned correctly based on tail
          height: bubbleH - padding * 2,
          color: textColor,
          fontSize,
          fontFamily: '"Comic Neue", "Comic Sans MS", cursive',
          lineHeight: 1.2,
          fontWeight: 500,
        }}
      >
        {text}
      </div>
    </div>
  );
};
