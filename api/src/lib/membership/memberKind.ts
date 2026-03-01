import type { GroupMembersEntity, MemberKind } from '../tables/entities.js';

export const resolveMemberKindFromSessionKind = (sessionKind: string): MemberKind => (sessionKind === 'igniteGrace' ? 'guest' : 'full');
export const resolveEmailVerifiedFromSessionKind = (sessionKind: string): boolean => sessionKind !== 'igniteGrace';

export const memberKindOrFull = (member: Pick<GroupMembersEntity, 'memberKind'>): MemberKind => member.memberKind ?? 'full';
export const emailVerifiedOrTrue = (member: Pick<GroupMembersEntity, 'emailVerified'>): boolean => member.emailVerified ?? true;
