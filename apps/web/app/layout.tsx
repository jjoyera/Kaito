import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
	title: "Kaito Scaffold",
	description: "Minimal runnable frontend boundary for Kaito.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
