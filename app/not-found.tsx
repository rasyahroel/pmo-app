import ErrorState from "@/components/common/ErrorState";

export default function NotFound() {
  return <ErrorState code={404} />;
}
