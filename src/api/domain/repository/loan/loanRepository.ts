import type { EntityData, ListData } from '@domain/model/generic/repositoryData'
import type { GetLoan, SaveLoan } from '@domain/model/loan/loan'
import type { LoanListItem } from '@domain/model/loan/loanListItem'

export interface ILoanRepository {
  fetchListWithRelations: () => Promise<ListData<LoanListItem>> // join 集約
  fetchDetail: (id: string) => Promise<EntityData<GetLoan>>
  save: (command: SaveLoan) => Promise<boolean>
}
