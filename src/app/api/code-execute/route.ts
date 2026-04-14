import { NextRequest, NextResponse } from 'next/server';
import type { ProgrammingLanguage } from '@/types/exam';

const PISTON_ENDPOINT = 'https://emkc.org/api/v2/piston/execute';

const languageConfig: Record<ProgrammingLanguage, { version: string; fileName: string }> = {
    javascript: { version: '18.15.0', fileName: 'main.js' },
    python: { version: '3.10.0', fileName: 'main.py' },
    java: { version: '15.0.2', fileName: 'Main.java' },
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { language, source, stdin } = body as {
            language?: ProgrammingLanguage;
            source?: string;
            stdin?: string;
        };

        if (!language || !languageConfig[language]) {
            return NextResponse.json({ error: 'Unsupported language.' }, { status: 400 });
        }

        if (!source?.trim()) {
            return NextResponse.json({ error: 'Source code is required.' }, { status: 400 });
        }

        const config = languageConfig[language];
        const response = await fetch(PISTON_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                language,
                version: config.version,
                files: [{ name: config.fileName, content: source }],
                stdin: stdin || '',
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json({ error: errorText || 'Execution service failed.' }, { status: 502 });
        }

        const result = await response.json();
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Code execution error:', error);
        return NextResponse.json({ error: error.message || 'Failed to execute code.' }, { status: 500 });
    }
}
