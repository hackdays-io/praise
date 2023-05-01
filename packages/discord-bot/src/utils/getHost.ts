import { apiClient } from './api';
import Keyv from 'keyv';
import { CommunityPaginatedResponseDto } from './api-schema';
import { DiscordClient } from '../interfaces/DiscordClient';

/**
 * Cache host after fetching communities from API
 *
 * @param {string} guildId
 * @returns {Promise<string | undefined>}
 */
export const cacheHosts = async (
  hostCache: Keyv,
  idCache: Keyv
): Promise<void> => {
  let currPage = 1;
  let totalPages = 1;
  while (currPage <= totalPages) {
    const communityList = await apiClient
      .get(`/communities?page=${currPage}`)
      .then<CommunityPaginatedResponseDto>((res) => res.data);

    for (const community of communityList.docs) {
      if (community.discordGuildId) {
        await hostCache.set(community.discordGuildId, community.hostname);
        await idCache.set(community.discordGuildId, community._id);
      }
    }

    currPage++;
    totalPages = communityList.totalPages;
  }
};

/**
 * Fetch Host by id
 *
 * @param {string} guildId
 * @returns {Promise<string | undefined>}
 */
export const getHost = async (
  client: DiscordClient,
  guildId: string
): Promise<string | undefined> => {
  let host = await client.hostCache.get(guildId);

  if (host === undefined) {
    await cacheHosts(client.hostCache, client.hostIdCache);
    host = await client.hostCache.get(guildId);
  }

  return host;
};

/**
 * Fetch Host by id
 *
 * @param {string} guildId
 * @returns {Promise<string | undefined>}
 */
export const getHostId = async (
  client: DiscordClient,
  guildId: string
): Promise<string | undefined> => {
  let host = await client.hostIdCache.get(guildId);

  if (host === undefined) {
    await cacheHosts(client.hostCache, client.hostIdCache);
    host = await client.hostIdCache.get(guildId);
  }

  return host;
};