export function isRevertLikeRelation(relationToIslam: string | null | undefined) {
  const normalizedRelation = relationToIslam?.toLowerCase()

  return Boolean(
    normalizedRelation &&
      (normalizedRelation.includes('revert') || normalizedRelation.includes('convert')),
  )
}