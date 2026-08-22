import { getValidAccessToken } from "./tiktok-oauth.mjs";

const USER_FIELDS = "open_id,display_name,avatar_url,follower_count,following_count,likes_count,video_count";
const VIDEO_FIELDS = "id,create_time,cover_image_url,share_url,video_description,duration,like_count,comment_count,share_count,view_count";

export async function fetchTikTokMetrics(root) {
  try {
    const accessToken = await getValidAccessToken(root);
    const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" };
    const userResponse = await fetch(`https://open.tiktokapis.com/v2/user/info/?fields=${USER_FIELDS}`, { headers });
    const userPayload = await userResponse.json();
    if (!userResponse.ok || userPayload.error?.code !== "ok") throw new Error(userPayload.error?.message || "TikTok user info unavailable");
    const videosResponse = await fetch(`https://open.tiktokapis.com/v2/video/list/?fields=${VIDEO_FIELDS}`, {
      method: "POST", headers, body: JSON.stringify({ max_count: 12 })
    });
    const videosPayload = await videosResponse.json();
    if (!videosResponse.ok || videosPayload.error?.code !== "ok") throw new Error(videosPayload.error?.message || "TikTok video metrics unavailable");
    const videos = videosPayload.data?.videos ?? [];
    const totals = videos.reduce((sum, video) => ({
      views: sum.views + Number(video.view_count ?? 0),
      likes: sum.likes + Number(video.like_count ?? 0),
      comments: sum.comments + Number(video.comment_count ?? 0),
      shares: sum.shares + Number(video.share_count ?? 0)
    }), { views: 0, likes: 0, comments: 0, shares: 0 });
    return {
      available: true,
      fetchedAt: new Date().toISOString(),
      profile: userPayload.data?.user ?? {},
      recent: videos,
      totals: { ...totals, engagementRate: totals.views ? Number(((totals.likes + totals.comments + totals.shares) / totals.views * 100).toFixed(2)) : 0 }
    };
  } catch (error) {
    return {
      available: false,
      message: error.message,
      requiredScopes: ["user.info.basic", "user.info.stats", "video.list"],
      fetchedAt: new Date().toISOString()
    };
  }
}
