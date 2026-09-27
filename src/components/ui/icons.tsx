// Small line icons drawn on a 20px grid. Decorative by default: pair them with visible text.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, className = "size-4", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m4.5 10.5 3.5 3.5 7.5-8" />
    </Icon>
  );
}

export function CrossIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5.5 5.5 9 9m0-9-9 9" />
    </Icon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 3.2 17.4 16H2.6L10 3.2Z" />
      <path d="M10 8.2v3.6m0 2.3v.1" />
    </Icon>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="10" r="7.2" />
      <path d="M10 9v4.6M10 6.4v.1" />
    </Icon>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 2.8c.5 3.6 1.6 4.7 5.2 5.2-3.6.5-4.7 1.6-5.2 5.2-.5-3.6-1.6-4.7-5.2-5.2 3.6-.5 4.7-1.6 5.2-5.2Z" />
      <path d="M15.5 13.2c.2 1.4.7 1.9 2.1 2.1-1.4.2-1.9.7-2.1 2.1-.2-1.4-.7-1.9-2.1-2.1 1.4-.2 1.9-.7 2.1-2.1Z" />
    </Icon>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8.3 11.7a3.2 3.2 0 0 0 4.6 0l2.6-2.6a3.2 3.2 0 0 0-4.6-4.6l-.8.8" />
      <path d="M11.7 8.3a3.2 3.2 0 0 0-4.6 0l-2.6 2.6a3.2 3.2 0 0 0 4.6 4.6l.8-.8" />
    </Icon>
  );
}

export function ResetIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.8 8.5A6.4 6.4 0 1 1 4.6 13" />
      <path d="M3.5 4.2v4.5H8" />
    </Icon>
  );
}

export function UndoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7.5 5 3.8 8.7l3.7 3.7" />
      <path d="M4 8.7h7.6a4.6 4.6 0 0 1 0 9.2H9" />
    </Icon>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5.5 7.8 4.5 4.5 4.5-4.5" />
    </Icon>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 10h11.2M10.2 4.8 15.4 10l-5.2 5.2" />
    </Icon>
  );
}

export function PrinterIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5.5 7.5V3.2h9v4.3" />
      <path d="M5.5 14.2H3.8a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1h12.4a1 1 0 0 1 1 1v4.7a1 1 0 0 1-1 1h-1.7" />
      <path d="M5.5 11.5h9v5.3h-9z" />
    </Icon>
  );
}

export function RulerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m2.8 13.6 10.8-10.8 3.6 3.6L6.4 17.2z" />
      <path d="m6.2 10.2 1.6 1.6m.9-4.1 1.6 1.6m.9-4.1 1.6 1.6" />
    </Icon>
  );
}

export function WrenchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12.6 3.4a4 4 0 0 0-4.9 5.2L3.4 12.9a1.8 1.8 0 0 0 2.6 2.6l4.3-4.3a4 4 0 0 0 5.2-4.9l-2.4 2.4-2.1-.5-.5-2.1 2.1-2.7Z" />
    </Icon>
  );
}
