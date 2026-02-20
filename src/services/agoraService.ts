/**
 * Agora RTC Service
 * Handles WebRTC streaming via Agora SDK for exam proctoring.
 *
 * Students publish:
 *   - Camera + Audio → channel: exam_<examId>_<userId>_cam
 *   - Screen video   → channel: exam_<examId>_<userId>_scr
 *
 * Admins subscribe to both channels to view camera and screen separately.
 *
 * NOTE: agora-rtc-sdk-ng is lazily imported (dynamic import) so it never
 * runs during SSR — it only loads in the browser.
 */

import type AgoraRTCType from 'agora-rtc-sdk-ng';
import type {
    IAgoraRTCClient,
    ILocalVideoTrack,
    ILocalAudioTrack,
    IRemoteVideoTrack,
    IRemoteAudioTrack,
    UID,
} from 'agora-rtc-sdk-ng';

// ============ CONFIG ============
const AGORA_APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || '';

// ============ LAZY AGORA LOADER ============

let _AgoraRTC: typeof AgoraRTCType | null = null;

async function getAgoraRTC(): Promise<typeof AgoraRTCType | null> {
    if (typeof window === 'undefined') return null;
    if (_AgoraRTC) return _AgoraRTC;
    const mod = await import('agora-rtc-sdk-ng');
    // Handle both ESM (.default) and CJS (module itself) export shapes
    _AgoraRTC = (mod.default ?? mod) as typeof AgoraRTCType;
    // Suppress Agora verbose/warning logs (4 = ERROR only)
    _AgoraRTC.setLogLevel(4);
    return _AgoraRTC;
}

// ============ TOKEN HELPER ============

async function fetchToken(channelName: string, role: 'student' | 'admin'): Promise<string | null> {
    try {
        const res = await fetch('/api/agora-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelName, role }),
        });
        if (res.ok) {
            const data = await res.json();
            console.log(`[Agora] Token fetched for ${role} on channel ${channelName}`);
            return data.token;
        }
        console.warn('[Agora] Token API returned', res.status, '— falling back to null token');
        return null;
    } catch (e) {
        console.warn('[Agora] Token API unreachable — falling back to null token');
        return null;
    }
}

// ============ CHANNEL HELPERS ============

export function getAgoraChannel(examId: string, userId: string): string {
    return `exam_${examId}_${userId}_cam`;
}

export function getAgoraScreenChannel(examId: string, userId: string): string {
    return `exam_${examId}_${userId}_scr`;
}

// ============ STUDENT PUBLISHER ============

let studentCamClient: IAgoraRTCClient | null = null;
let studentScrClient: IAgoraRTCClient | null = null;
let localCameraTrack: ILocalVideoTrack | null = null;
let localAudioTrack: ILocalAudioTrack | null = null;
let localScreenTrack: ILocalVideoTrack | null = null;

/**
 * Student: Join camera channel and publish camera + audio.
 * Also joins screen channel and publishes the screen track.
 */
export async function studentJoinAndPublish(
    camChannel: string,
    cameraStream: MediaStream | null,
    micStream: MediaStream | null,
    screenStream?: MediaStream | null,
): Promise<{ uid: UID; client: IAgoraRTCClient } | null> {
    if (!AGORA_APP_ID) {
        console.warn('[Agora] App ID not set. Skipping Agora integration.');
        return null;
    }

    // Guard: already joined, don't rejoin
    if (studentCamClient) {
        console.warn('[Agora] studentJoinAndPublish called but camera client already exists. Skipping.');
        return null;
    }

    const AgoraRTC = await getAgoraRTC();
    if (!AgoraRTC) return null;

    try {
        // ---- Camera + Audio client ----
        studentCamClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        const camToken = await fetchToken(camChannel, 'student');

        console.log('[Agora] Student joining camera channel:', camChannel);
        const uid = await studentCamClient.join(AGORA_APP_ID, camChannel, camToken, null);
        console.log('[Agora] Student joined camera channel UID:', uid);

        const camTracks: (ILocalVideoTrack | ILocalAudioTrack)[] = [];

        if (cameraStream) {
            const videoTrack = cameraStream.getVideoTracks()[0];
            if (videoTrack) {
                localCameraTrack = AgoraRTC.createCustomVideoTrack({
                    mediaStreamTrack: videoTrack.clone(),
                });
                camTracks.push(localCameraTrack);
                console.log('[Agora] Camera video track created');
            }
        }

        if (micStream) {
            const audioTrack = micStream.getAudioTracks()[0];
            if (audioTrack) {
                localAudioTrack = AgoraRTC.createCustomAudioTrack({
                    mediaStreamTrack: audioTrack.clone(),
                });
                camTracks.push(localAudioTrack);
                console.log('[Agora] Audio track created');
            }
        }

        if (camTracks.length > 0) {
            await studentCamClient.publish(camTracks);
            console.log('[Agora] Published', camTracks.length, 'camera/audio tracks');
        }

        // ---- Screen Track (separate channel) ----
        if (screenStream) {
            await publishScreenTrack(camChannel, screenStream);
        }

        return { uid, client: studentCamClient };
    } catch (error) {
        console.error('[Agora] Student join error:', error);
        studentCamClient = null;
        return null;
    }
}

/**
 * Publish (or re-publish) the screen stream to the screen channel.
 */
export async function publishScreenTrack(
    camChannel: string,
    screenStream: MediaStream,
): Promise<void> {
    if (!AGORA_APP_ID) return;

    const AgoraRTC = await getAgoraRTC();
    if (!AgoraRTC) return;

    try {
        const scrChannel = camChannel.replace(/_cam$/, '_scr');

        // Leave previous screen client if any
        if (studentScrClient) {
            try {
                localScreenTrack?.close();
                localScreenTrack = null;
                await studentScrClient.leave();
                studentScrClient = null;
            } catch (e) { /* ignore */ }
        }

        studentScrClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        const scrToken = await fetchToken(scrChannel, 'student');

        console.log('[Agora] Student joining screen channel:', scrChannel);
        await studentScrClient.join(AGORA_APP_ID, scrChannel, scrToken, null);
        console.log('[Agora] Student joined screen channel');

        const screenVideoTrack = screenStream.getVideoTracks()[0];
        if (screenVideoTrack) {
            localScreenTrack = AgoraRTC.createCustomVideoTrack({
                mediaStreamTrack: screenVideoTrack.clone(),
            });
            await studentScrClient.publish([localScreenTrack]);
            console.log('[Agora] Screen track published');

            // Auto-clean when screen track ends
            screenVideoTrack.addEventListener('ended', async () => {
                console.log('[Agora] Screen track ended, cleaning up');
                try {
                    localScreenTrack?.close();
                    localScreenTrack = null;
                    if (studentScrClient) {
                        await studentScrClient.leave();
                        studentScrClient = null;
                    }
                } catch (e) { /* ignore */ }
            });
        }
    } catch (error) {
        console.error('[Agora] Screen publish error:', error);
    }
}

/**
 * Student: Leave both channels and clean up all tracks.
 */
export async function studentLeave(): Promise<void> {
    try {
        localCameraTrack?.close();
        localAudioTrack?.close();
        localScreenTrack?.close();
        localCameraTrack = null;
        localAudioTrack = null;
        localScreenTrack = null;

        if (studentCamClient) {
            await studentCamClient.leave();
            studentCamClient = null;
        }
        if (studentScrClient) {
            await studentScrClient.leave();
            studentScrClient = null;
        }
    } catch (error) {
        console.error('[Agora] Student leave error:', error);
    }
}

// ============ ADMIN SUBSCRIBER ============

/**
 * Admin: Subscribe to a student's camera channel.
 */
export async function adminSubscribeToCamera(
    camChannel: string,
    onVideoTrack: (track: IRemoteVideoTrack, uid: UID) => void,
    onAudioTrack: (track: IRemoteAudioTrack, uid: UID) => void,
    onUserLeft: (uid: UID) => void,
): Promise<{ client: IAgoraRTCClient; leave: () => Promise<void> } | null> {
    return _adminSubscribe(camChannel, onVideoTrack, onAudioTrack, onUserLeft);
}

/**
 * Admin: Subscribe to a student's screen channel.
 */
export async function adminSubscribeToScreen(
    camChannel: string,
    onVideoTrack: (track: IRemoteVideoTrack, uid: UID) => void,
    onUserLeft: (uid: UID) => void,
): Promise<{ client: IAgoraRTCClient; leave: () => Promise<void> } | null> {
    const scrChannel = camChannel.replace(/_cam$/, '_scr');
    return _adminSubscribe(
        scrChannel,
        onVideoTrack,
        () => { /* no audio from screen channel */ },
        onUserLeft,
    );
}

/**
 * Internal helper: join a channel and subscribe to remote tracks.
 */
async function _adminSubscribe(
    channel: string,
    onVideoTrack: (track: IRemoteVideoTrack, uid: UID) => void,
    onAudioTrack: (track: IRemoteAudioTrack, uid: UID) => void,
    onUserLeft: (uid: UID) => void,
): Promise<{ client: IAgoraRTCClient; leave: () => Promise<void> } | null> {
    if (!AGORA_APP_ID) {
        console.warn('[Agora] App ID not set. Skipping admin subscription.');
        return null;
    }

    const AgoraRTC = await getAgoraRTC();
    if (!AgoraRTC) return null;

    try {
        const adminClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

        adminClient.on('user-published', async (user, mediaType) => {
            console.log('[Agora Admin] user-published:', user.uid, mediaType, 'on', channel);
            await adminClient.subscribe(user, mediaType);
            if (mediaType === 'video' && user.videoTrack) {
                onVideoTrack(user.videoTrack, user.uid);
            }
            if (mediaType === 'audio' && user.audioTrack) {
                onAudioTrack(user.audioTrack, user.uid);
            }
        });

        adminClient.on('user-left', (user) => {
            console.log('[Agora Admin] user-left:', user.uid, 'on', channel);
            onUserLeft(user.uid);
        });

        adminClient.on('user-joined', (user) => {
            console.log('[Agora Admin] user-joined:', user.uid, 'on', channel);
        });

        const token = await fetchToken(channel, 'admin');

        console.log('[Agora Admin] Joining channel:', channel);
        const uid = await adminClient.join(AGORA_APP_ID, channel, token, null);
        console.log('[Agora Admin] Joined with UID:', uid);

        // Subscribe to already-present remote users
        for (const user of adminClient.remoteUsers) {
            if (user.hasVideo) {
                await adminClient.subscribe(user, 'video');
                if (user.videoTrack) onVideoTrack(user.videoTrack, user.uid);
            }
            if (user.hasAudio) {
                await adminClient.subscribe(user, 'audio');
                if (user.audioTrack) onAudioTrack(user.audioTrack, user.uid);
            }
        }

        return {
            client: adminClient,
            leave: async () => {
                try {
                    await adminClient.leave();
                    console.log('[Agora Admin] Left channel', channel);
                } catch (e) {
                    console.error('[Agora Admin] Leave error:', e);
                }
            },
        };
    } catch (error) {
        console.error('[Agora Admin] Subscribe error on channel', channel, ':', error);
        return null;
    }
}

/**
 * Check if Agora is configured (safe to call on server — no window access).
 */
export function isAgoraConfigured(): boolean {
    return !!AGORA_APP_ID;
}
