import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
	title: "KAITO",
	description: "Trail and ultra-trail training planning.",
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
