const VERCEL_DEPLOYMENTS_API = 'https://api.vercel.com/v6/deployments';

export interface VercelDeploymentEntity {
  uid: string;
  name: string;
  url: string;
  state: string;
  created: number;
  creator?: {
    username?: string;
    email?: string;
  };
  meta?: Record<string, string>;
}

export interface VercelDeploymentResponse {
  deployments: VercelDeploymentEntity[];
  pagination?: {
    next?: number;
    prev?: number;
    count?: number;
  };
}

export interface VercelStatusPayload {
  deployments: Array<{
    id: string;
    url: string;
    state: string;
    createdAt: string;
    creator?: string;
    environment?: string;
  }>;
  source: 'vercel' | 'disabled';
  message?: string;
}

const getToken = () => process.env.VERCEL_TOKEN;
const getProjectName = () => process.env.VERCEL_PROJECT_NAME ?? 'tapAz';
const getTeamId = () => process.env.VERCEL_TEAM_ID;

const buildHeaders = () => ({
  Authorization: `Bearer ${getToken()}`
});


export const fetchLatestDeployments = async (limit = 5): Promise<VercelStatusPayload> => {
  const token = getToken();
  const projectName = getProjectName();

  if (!token || !projectName) {
    return {
      deployments: [],
      source: 'disabled',
      message: 'VERCEL_TOKEN və VERCEL_PROJECT_NAME təyin edilməyib'
    };
  }

  try {
    const url = new URL(VERCEL_DEPLOYMENTS_API);
    url.searchParams.set('app', projectName);
    url.searchParams.set('limit', String(limit));
    const teamId = getTeamId();
    if (teamId) {
      url.searchParams.set('teamId', teamId);
    }

    const response = await fetch(url, {
      headers: buildHeaders(),
      cache: 'no-store'
    });

    if (!response.ok) {
      return {
        deployments: [],
        source: 'disabled',
        message: `Vercel API xətası (${response.status})`
      };
    }

    const data = (await response.json()) as VercelDeploymentResponse;
    const deployments = data.deployments.map((deployment) => ({
      id: deployment.uid,
      url: `https://${deployment.url}`,
      state: deployment.state,
      createdAt: new Date(deployment.created).toISOString(),
      creator: deployment.creator?.username ?? deployment.creator?.email,
      environment: deployment.meta?.deployHookId ?? deployment.meta?.githubCommitSha
    }));

    return {
      deployments,
      source: 'vercel'
    };
  } catch (error) {
    console.warn('Vercel deployments oxunmadı', error);
    return {
      deployments: [],
      source: 'disabled',
      message: (error as Error).message
    };
  }
};
