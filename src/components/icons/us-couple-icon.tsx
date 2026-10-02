import type { SVGProps } from "react";

export interface UsCoupleIconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
  color?: string;
}

export function UsCoupleIcon({
  size = 18,
  strokeWidth = 1.5,
  color = "currentColor",
  ...props
}: UsCoupleIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Left head (Me / Partner A) */}
      <circle cx="6.5" cy="7.5" r="2.75" />
      {/* Right head (Her / Partner B) with soft hair curve */}
      <circle cx="17.5" cy="7.5" r="2.75" />
      <path d="M20.5 7.5C20.5 10 19.5 12 19.5 13" />
      {/* Left shoulder */}
      <path d="M2.5 20V19C2.5 15.686 4.5 13.5 7.5 13.2" />
      {/* Right shoulder */}
      <path d="M21.5 20V19C21.5 15.686 19.5 13.5 16.5 13.2" />
      {/* Middle Heart (Centered between partners) */}
      <path d="M16 16.2798C16 16.8812 15.7625 17.4588 15.3383 17.8861C14.3619 18.8701 13.415 19.8961 12.4021 20.8443C12.17 21.0585 11.8017 21.0507 11.5795 20.8268L8.6615 17.8861C7.7795 16.9972 7.7795 15.5623 8.6615 14.6734C9.5522 13.7758 11.0032 13.7758 11.8938 14.6734L12 14.7803L12.1059 14.6734C12.533 14.2429 13.1146 14 13.7221 14C14.3297 14 14.9113 14.2428 15.3383 14.6734C15.7625 15.1007 16 15.6784 16 16.2798Z" />
    </svg>
  );
}
