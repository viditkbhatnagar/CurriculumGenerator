import { KnowledgeBaseBrowser } from '@/components/knowledge-base/KnowledgeBaseBrowser';

export default function KnowledgeBasePage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Knowledge Base</h1>
      <KnowledgeBaseBrowser />
    </div>
  );
}
