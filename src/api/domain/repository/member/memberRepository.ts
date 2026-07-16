import type { EntityData, ListData } from '@domain/model/generic/repositoryData'
import type { GetMember, SaveMember } from '@domain/model/member/member'
import type { ValidatedGetListMemberSearchConditions } from '@domain/model/member/memberSearchConditions'

export interface IMemberRepository {
  fetchList: (searchConditions: ValidatedGetListMemberSearchConditions) => Promise<ListData<GetMember>>
  fetchDetail: (id: string) => Promise<EntityData<GetMember>>
  save: (command: SaveMember) => Promise<boolean>
  findByEmail: (email: string) => Promise<ListData<GetMember>>
}
