import { marked } from 'marked';
import { BackHeader } from '../components/ui';
import privacy from '../../content/privacy.md?raw';
import terms from '../../content/terms.md?raw';

const pages = { terms, privacy };

// The markdown ships in this repo, so rendering it as HTML trusts nothing from outside.
export default function Legal({ page }: { page: keyof typeof pages }) {
  return (
    <div className="min-h-full">
      <BackHeader />
      <main
        className="legal mx-auto max-w-2xl px-5 pb-10"
        dangerouslySetInnerHTML={{ __html: marked.parse(pages[page], { async: false }) }}
      />
    </div>
  );
}
