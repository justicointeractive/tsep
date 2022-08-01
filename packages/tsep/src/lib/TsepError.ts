export class TsepError extends Error {
  constructor(public description: string, public index: number) {
    super(description + ' at character ' + index);
  }
}
