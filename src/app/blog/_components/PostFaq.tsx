/*
 * Visible FAQ plus its FAQPage JSON-LD, built from one array. It exists because several posts once
 * emitted FAQPage markup for questions that appeared nowhere on the page, which violates Google's
 * structured data policy (markup must describe visible content) and gives AI answer engines text a
 * reader cannot verify. Posts pass their questions here instead of writing a separate script tag.
 * Answers are plain text so the visible copy and the schema stay identical.
 */
export type FaqItem = { question: string; answer: string };

export function PostFaq({ items, id = "faq" }: { items: FaqItem[]; id?: string }) {
	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: items.map((item) => ({
			"@type": "Question",
			name: item.question,
			acceptedAnswer: { "@type": "Answer", text: item.answer },
		})),
	};

	return (
		<>
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
			<h2 id={id}>Frequently asked questions</h2>
			{items.map((item) => (
				<div key={item.question}>
					<h3>{item.question}</h3>
					<p>{item.answer}</p>
				</div>
			))}
		</>
	);
}
