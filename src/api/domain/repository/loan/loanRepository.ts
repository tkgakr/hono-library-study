import type { CalendarDate } from '@core/core'
import type { EntityData, ListData } from '@domain/model/generic/repositoryData'
import type { GetLoan, SaveLoan } from '@domain/model/loan/loan'
import type { LoanListItem } from '@domain/model/loan/loanListItem'

export interface ILoanRepository {
  // join 集約。ステータスの算出に使う「今日」は呼び出し側から受け取る（時計を infrastructure に持たせない）
  fetchListWithRelations: (today: CalendarDate) => Promise<ListData<LoanListItem>>
  fetchDetail: (id: string) => Promise<EntityData<GetLoan>>
  save: (command: SaveLoan) => Promise<boolean>
}
