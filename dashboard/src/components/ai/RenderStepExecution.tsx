import React from 'react';
import { motion } from 'framer-motion';
import { LightbulbOutlined, SearchOutlined, CheckCircleOutlined, CodeOutlined } from '@ant-design/icons';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

// --- Data Models (TypeScript Interfaces) ---
// These define the structure of the data this component expects.

interface Thought {
    text: string;
}

interface Search {
    query: string;
}

interface SearchResultItem {
    title: string;
    url: string;
    snippet: string;
}

interface SearchResult {
    query: string;
    results: SearchResultItem[];
}

interface Answer {
    text: string;
}

export type ExecutionStep =
    | { type: 'thought'; data: Thought }
    | { type: 'search'; data: Search }
    | { type: 'search_result'; data: SearchResult }
    | { type: 'answer'; data: Answer };

// --- Sub-components for Each Step Type ---

const ThoughtStep: React.FC<{ data: Thought }> = ({ data }) => (
    <div className="flex items-start space-x-4">
        <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
            <LightbulbOutlined className="text-yellow-600" />
        </div>
        <div className="flex-grow pt-1">
            <p className="font-semibold text-gray-800">Thought</p>
            <blockquote className="mt-1 border-l-4 border-gray-200 pl-4 text-gray-600 italic">
                {data.text}
            </blockquote>
        </div>
    </div>
);

const SearchStep: React.FC<{ data: Search }> = ({ data }) => (
    <div className="flex items-start space-x-4">
        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <SearchOutlined className="text-blue-600" />
        </div>
        <div className="flex-grow pt-1">
            <p className="font-semibold text-gray-800">Searching</p>
            <div className="mt-1 p-2 bg-gray-50 border border-gray-200 rounded-md">
                <code className="text-sm text-gray-700">{data.query}</code>
            </div>
        </div>
    </div>
);

const SearchResultStep: React.FC<{ data: SearchResult }> = ({ data }) => (
    <div className="flex items-start space-x-4">
        <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <CodeOutlined className="text-gray-600" />
        </div>
        <div className="flex-grow pt-1">
            <p className="font-semibold text-gray-800">Search Results for "{data.query}"</p>
            <div className="mt-2 space-y-3">
                {data.results.map((result, index) => (
                    <div key={index} className="p-3 bg-white border border-gray-200 rounded-lg">
                        <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                            {result.title}
                        </a>
                        <p className="text-xs text-gray-500 mt-1">{result.url}</p>
                        <p className="mt-2 text-sm text-gray-600">{result.snippet}</p>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const AnswerStep: React.FC<{ data: Answer }> = ({ data }) => (
    <div className="flex items-start space-x-4">
        <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircleOutlined className="text-green-600" />
        </div>
        <div className="flex-grow pt-1">
            <p className="font-semibold text-gray-800">Final Answer</p>
            <div className="prose prose-sm max-w-none mt-1 text-gray-700">
                <ReactMarkdown
                    rehypePlugins={[rehypeRaw]}
                    components={{
                        code({ node, inline, className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                                <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div" {...props}>
                                    {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                            ) : (
                                <code className="bg-gray-100 rounded-md px-1.5 py-0.5" {...props}>
                                    {children}
                                code>
                            );
                        },
                    }}
                >
                    {data.text}
                </ReactMarkdown>
            </div>
        </div>
    </div>
);


// --- Main Component ---

interface RenderStepExecutionProps {
    steps: ExecutionStep[];
}

export const RenderStepExecution: React.FC<RenderStepExecutionProps> = ({ steps }) => {
    if (!steps || steps.length === 0) {
        return (
            <div className="p-4 text-center text-gray-500">
                No execution steps to display.
            </div>
        );
    }

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2,
            },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                type: 'spring',
                stiffness: 100,
            },
        },
    };

    return (
        <motion.div
            className="p-4 bg-gray-50 rounded-lg space-y-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {steps.map((step, index) => (
                <motion.div key={index} variants={itemVariants}>
                    {
                        {
                            'thought': <ThoughtStep data={step.data as Thought} />,
                            'search': <SearchStep data={step.data as Search} />,
                            'search_result': <SearchResultStep data={step.data as SearchResult} />,
                            'answer': <AnswerStep data={step.data as Answer} />,
                        }[step.type]
                    }
                </motion.div>
            ))}
        </motion.div>
    );
};
