import type { GroupMembersEntity, MemberKind } from '../tables/entities.js';

export const resolveMemberKindFromSessionKind = (sessionKind: string): MemberKind => (sessionKind === 'igniteGrace' ? 'guest' : 'full');

export const memberKindOrFull = (member: Pick<GroupMembersEntity, 'memberKind'>): MemberKind => member.memberKind ?? 'full';
