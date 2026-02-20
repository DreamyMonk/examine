import { NextRequest, NextResponse } from 'next/server';
import { RtcTokenBuilder, RtcRole } from 'agora-access-token';

const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || '';
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || '';

export async function POST(request: NextRequest) {
    try {
        if (!APP_ID || !APP_CERTIFICATE) {
            return NextResponse.json(
                { error: 'Agora credentials not configured' },
                { status: 500 }
            );
        }

        const body = await request.json();
        const { channelName, role } = body;

        if (!channelName) {
            return NextResponse.json(
                { error: 'channelName is required' },
                { status: 400 }
            );
        }

        // Token expires in 24 hours
        const expirationTimeInSeconds = 86400;
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

        // Use publisher role for students (they publish), subscriber for admins
        const rtcRole = role === 'admin' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;

        // uid 0 means Agora will assign one
        const token = RtcTokenBuilder.buildTokenWithUid(
            APP_ID,
            APP_CERTIFICATE,
            channelName,
            0,
            rtcRole,
            privilegeExpiredTs
        );

        return NextResponse.json({ token });
    } catch (error: any) {
        console.error('Token generation error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate token' },
            { status: 500 }
        );
    }
}
