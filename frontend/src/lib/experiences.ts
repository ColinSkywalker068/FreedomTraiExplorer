export interface LandmarkExperience {
  id: 'old-north-lantern-mission' | 'old-state-house-boston-massacre'
  landmarkId: 'old-north-church' | 'old-state-house'
  title: string
  setting: string
  premise: string
  status: 'coming-soon'
}
export const experiences: readonly LandmarkExperience[] = [
  {
    id: 'old-north-lantern-mission',
    landmarkId: 'old-north-church',
    title: 'The lantern signal',
    setting: 'April 18, 1775',
    premise: 'Follow the two-lantern warning from Old North Church on the eve of the Revolution.',
    status: 'coming-soon',
  },
  {
    id: 'old-state-house-boston-massacre',
    landmarkId: 'old-state-house',
    title: 'Witness to the Boston Massacre',
    setting: 'March 5, 1770',
    premise: 'Explore the Boston Massacre outside the Old State House and the accounts that shaped its aftermath.',
    status: 'coming-soon',
  },
]

export function experienceForLandmark(landmarkId: string): LandmarkExperience | undefined {
  return experiences.find(experience => experience.landmarkId === landmarkId)
}
