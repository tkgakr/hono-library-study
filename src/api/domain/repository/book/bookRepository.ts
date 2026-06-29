import type { GetBook, SaveBook } from '@domain/model/book/book'
import type { ValidatedGetListBookSearchConditions } from '@domain/model/book/bookSearchConditions'
import type { EntityData, ListData } from '@domain/model/generic/repositoryData'

export interface IBookRepository {
  fetchList: (searchConditions: ValidatedGetListBookSearchConditions) => Promise<ListData<GetBook>>
  fetchDetail: (id: string) => Promise<EntityData<GetBook>>
  save: (command: SaveBook) => Promise<boolean>
  findByTitle: (title: string) => Promise<ListData<GetBook>>
}
