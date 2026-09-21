/** Spring Data `Page<T>` JSON shape (the backend returns it unwrapped). */
export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  numberOfElements?: number
  first: boolean
  last: boolean
  empty: boolean
}

export interface PageParams {
  page?: number
  size?: number
  /** Spring format: `field,asc|desc` */
  sort?: string
}
