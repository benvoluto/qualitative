/* eslint-disable @next/next/no-img-element */

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
}

/**
 * Site logo. Renders /assets/qual.svg via a plain <img> tag — the SVG carries
 * its own colors and a rounded-rect background, so it doesn't theme to the
 * surrounding text color.
 */
export function Logo({ className, width = 40, height = 40 }: LogoProps) {
  return (
    <img
      src="/assets/qual.svg"
      alt="Qualitative"
      width={width}
      height={height}
      className={`${className} drop-shadow-md`}
    />
  );
}
